import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { createNotification } from '@/lib/notifications'

const abonoSchema = z.object({
  amount_usd:        z.number().positive(),
  payment_method_id: z.number().int().positive(),
  notes:             z.string().max(500).optional(),
})

// Errors thrown inside the transaction that map to 4xx
const TX_400 = 'SALDO:'
const TX_404 = 'Venta no encontrada o ya pagada'

type Context = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Context) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = abonoSchema.parse(await req.json())

    // Verify payment method outside tx (fuera del $transaction) → tenant layer
    const payMethod = await db.paymentMethod.findFirst({
      where: { id: body.payment_method_id }, // business_id inyectado
    })
    if (!payMethod) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

    // Fetch active rate (manual override del tenant o BCV) fuera de tx
    const { rate } = await getActiveRate(session.businessId)
    const amountBs = Math.round(body.amount_usd * rate * 100) / 100

    // CX-RACE fix: saldo check + create inside a single interactive transaction.
    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const { abono, saldoFinal, nowPaid, ticketNumber } = await prisma.$transaction(async (tx) => {
      // Re-read sale + all abonos atomically inside the tx
      const sale = await tx.sale.findFirst({
        where:   { id: saleId, business_id: session.businessId, status: 'credit' },
        include: { abonos: { select: { amount_usd: true } } },
      })
      if (!sale) throw new Error(TX_404)

      const totalUsd    = Number(sale.total_usd)
      const abonadoPrev = sale.abonos.reduce((a, b) => a + Number(b.amount_usd), 0)
      const saldoPrev   = Math.max(0, Math.round((totalUsd - abonadoPrev) * 100) / 100)

      if (body.amount_usd > saldoPrev + 0.01) {
        throw new Error(
          `${TX_400}El abono (${body.amount_usd.toFixed(2)}) supera el saldo pendiente (${saldoPrev.toFixed(2)})`
        )
      }

      const newAbono = await tx.saleAbono.create({
        data: {
          sale_id:           saleId,
          payment_method_id: body.payment_method_id,
          amount_usd:        body.amount_usd,
          amount_bs:         amountBs,
          rate_used:         rate,
          notes:             body.notes ?? null,
          created_by:        session.userId,
        },
      })

      const saldoNew = Math.round((saldoPrev - body.amount_usd) * 100) / 100
      const paid     = saldoNew <= 0.01

      if (paid) {
        await tx.sale.update({ where: { id: saleId }, data: { status: 'paid', sold_at: new Date() } })
      }

      return { abono: newAbono, saldoFinal: Math.max(0, saldoNew), nowPaid: paid, ticketNumber: sale.ticket_number }
    })

    if (nowPaid) {
      void createNotification(
        session.businessId,
        'credit_paid',
        'Crédito saldado',
        `Venta ${ticketNumber} ha sido pagada completamente.`,
        'sale',
        saleId
      ).catch(() => {})
    }

    return NextResponse.json({
      ok:        true,
      abono:     { ...abono, amount_usd: Number(abono.amount_usd), amount_bs: Number(abono.amount_bs) },
      saldo_usd: saldoFinal,
      paid:      nowPaid,
    }, { status: 201 })

  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof Error) {
      if (err.message === TX_404) return NextResponse.json({ error: TX_404 }, { status: 404 })
      if (err.message.startsWith(TX_400)) return NextResponse.json({ error: err.message.slice(TX_400.length) }, { status: 400 })
    }
    console.error('cxc abono POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
