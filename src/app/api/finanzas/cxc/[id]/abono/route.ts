import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { createNotification } from '@/lib/notifications'

const abonoSchema = z.object({
  amount_usd:        z.number().positive(),
  payment_method_id: z.number().int().positive(),
  notes:             z.string().max(500).optional(),
})

type Context = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = abonoSchema.parse(await req.json())

    const sale = await prisma.sale.findFirst({
      where:   { id: saleId, business_id: session.businessId, status: 'pending' },
      include: { abonos: { select: { amount_usd: true } } },
    })
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada o ya pagada' }, { status: 404 })

    const totalUsd    = Number(sale.total_usd)
    const abonadoPrev = sale.abonos.reduce((a, b) => a + Number(b.amount_usd), 0)
    const saldoPrev   = Math.max(0, Math.round((totalUsd - abonadoPrev) * 100) / 100)

    if (body.amount_usd > saldoPrev + 0.01) {
      return NextResponse.json(
        { error: `El abono (${body.amount_usd.toFixed(2)}) supera el saldo pendiente (${saldoPrev.toFixed(2)})` },
        { status: 400 }
      )
    }

    // Verify payment method belongs to this business
    const payMethod = await prisma.paymentMethod.findFirst({
      where: { id: body.payment_method_id, business_id: session.businessId },
    })
    if (!payMethod) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

    const rate      = await getBcvRate(session.businessId)
    const amountBs  = Math.round(body.amount_usd * rate * 100) / 100

    const saldoNew  = Math.round((saldoPrev - body.amount_usd) * 100) / 100
    const nowPaid   = saldoNew <= 0.01

    const [abono] = await prisma.$transaction([
      prisma.saleAbono.create({
        data: {
          sale_id:           saleId,
          payment_method_id: body.payment_method_id,
          amount_usd:        body.amount_usd,
          amount_bs:         amountBs,
          rate_used:         rate,
          notes:             body.notes ?? null,
          created_by:        session.userId,
        },
      }),
      ...(nowPaid
        ? [prisma.sale.update({ where: { id: saleId }, data: { status: 'paid', sold_at: new Date() } })]
        : []),
    ])

    if (nowPaid) {
      void createNotification(
        session.businessId,
        'credit_paid',
        'Crédito saldado',
        `Venta ${sale.ticket_number} ha sido pagada completamente.`,
        'sale',
        saleId
      ).catch(() => {})
    }

    return NextResponse.json({
      ok:        true,
      abono:     { ...abono, amount_usd: Number(abono.amount_usd), amount_bs: Number(abono.amount_bs) },
      saldo_usd: Math.max(0, saldoNew),
      paid:      nowPaid,
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('cxc abono POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
