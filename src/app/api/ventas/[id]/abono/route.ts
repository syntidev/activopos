import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getBcvRate } from '@/lib/bcv'

type RouteContext = { params: { id: string } }

class OverpaymentError extends Error {
  readonly code = 'OVERPAYMENT' as const
  constructor(message: string) { super(message); this.name = 'OverpaymentError' }
}

const abonoSchema = z.object({
  payment_method_id: z.number().int().positive(),
  amount_usd:        z.number().positive(),
  reference:         z.string().max(100).optional(),
  notes:             z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = abonoSchema.parse(await req.json())

    const [sale, pm, rate, activeRegister] = await Promise.all([
      prisma.sale.findFirst({
        where: { id: saleId, business_id: session.businessId, status: 'credit' },
        select: { id: true, total_usd: true, ticket_number: true, client_id: true },
      }),
      prisma.paymentMethod.findFirst({
        where: { id: body.payment_method_id, business_id: session.businessId, is_active: true },
        select: { id: true },
      }),
      getBcvRate(),
      prisma.cashRegister.findFirst({
        where: { business_id: session.businessId, closed_at: null },
        select: { id: true },
      }),
    ])

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada o ya liquidada' }, { status: 404 })
    }
    if (!pm) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })
    }
    if (!activeRegister) {
      return NextResponse.json({ error: 'Debes abrir la caja antes de registrar un abono' }, { status: 400 })
    }

    const { abono, sumAbonado } = await prisma.$transaction(async (tx) => {
      // Row lock: serializa abonos concurrentes sobre la misma venta (fix TOCTOU)
      await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} FOR UPDATE`

      const prevAgg = await tx.saleAbono.aggregate({
        where: { sale_id: saleId },
        _sum:  { amount_usd: true },
      })
      const saldoPrev = Number(sale.total_usd) - Number(prevAgg._sum.amount_usd ?? 0)
      if (body.amount_usd > saldoPrev + 0.01) {
        throw new OverpaymentError(
          `El abono ($${body.amount_usd}) supera el saldo pendiente ($${saldoPrev.toFixed(2)})`,
        )
      }

      const amount_bs = body.amount_usd * rate

      const newAbono = await tx.saleAbono.create({
        data: {
          sale_id:           saleId,
          payment_method_id: body.payment_method_id,
          cash_register_id:  activeRegister.id,
          amount_usd:        body.amount_usd,
          amount_bs,
          rate_used:         rate,
          reference:         body.reference ?? null,
          notes:             body.notes ?? null,
          created_by:        session.userId,
        },
      })

      // Auto-cerrar si suma de abonos >= total
      const totalAbonado = await tx.saleAbono.aggregate({
        where:  { sale_id: saleId },
        _sum:   { amount_usd: true },
      })
      const sumAbonado = Number(totalAbonado._sum.amount_usd ?? 0)

      if (sumAbonado >= Number(sale.total_usd) - 0.01) {
        await tx.sale.update({
          where: { id: saleId },
          data:  { status: 'paid', sold_at: new Date() },
        })
        await tx.activityLog.create({
          data: {
            business_id: session.businessId,
            user_id:     session.userId,
            action:      'sale_paid_by_abono',
            model_type:  'Sale',
            model_id:    saleId,
            new_values:  { ticket_number: sale.ticket_number, total_abonado: sumAbonado },
          },
        })
      } else {
        await tx.activityLog.create({
          data: {
            business_id: session.businessId,
            user_id:     session.userId,
            action:      'sale_abono',
            model_type:  'Sale',
            model_id:    saleId,
            new_values:  {
              ticket_number:  sale.ticket_number,
              amount_usd:     body.amount_usd,
              total_abonado:  sumAbonado,
              pending:        Math.max(0, Number(sale.total_usd) - sumAbonado),
            },
          },
        })
      }

      return { abono: newAbono, sumAbonado }
    })

    const saldoNew = Math.max(0, Number(sale.total_usd) - sumAbonado)

    return NextResponse.json({
      ok:        true,
      abono:     {
        ...abono,
        amount_usd: Number(abono.amount_usd),
        amount_bs:  Number(abono.amount_bs),
        rate_used:  Number(abono.rate_used),
      },
      saldo_usd: saldoNew,
      paid:      saldoNew <= 0.01,
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof OverpaymentError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error(`ventas/${saleId}/abono POST:`, err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
