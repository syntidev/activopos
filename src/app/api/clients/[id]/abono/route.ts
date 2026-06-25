import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type RouteContext = { params: { id: string } }

const abonoSchema = z.object({
  sale_id:           z.number().int().positive(),
  amount_usd:        z.number().positive(),
  payment_method_id: z.number().int().positive(),
  reference:         z.string().max(100).optional(),
  notes:             z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const clientId = parseInt(params.id)
  if (isNaN(clientId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const data = abonoSchema.parse(body)

    /* Verify sale belongs to this client + business and is still pending */
    const sale = await prisma.sale.findFirst({
      where: {
        id:          data.sale_id,
        client_id:   clientId,
        business_id: session.businessId,
        status:      'pending',
      },
      select: { id: true, total_usd: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada o ya cerrada' }, { status: 404 })
    }

    /* Verify payment method belongs to this business */
    const pm = await prisma.paymentMethod.findFirst({
      where: { id: data.payment_method_id, business_id: session.businessId, is_active: true },
    })
    if (!pm) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

    /* Active cash register — required to track abono in shift */
    const activeRegister = await prisma.cashRegister.findFirst({
      where: { business_id: session.businessId, closed_at: null },
      select: { id: true },
    })
    if (!activeRegister) {
      return NextResponse.json({ error: 'No hay turno de caja abierto' }, { status: 400 })
    }

    /* Current BCV rate */
    type RateRow = { rate: string | number }
    const rateRows = await prisma.$queryRaw<RateRow[]>`
      SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1
    `
    const rateUsed = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
    const amountBs = data.amount_usd * rateUsed

    const abono = await prisma.saleAbono.create({
      data: {
        sale_id:           data.sale_id,
        payment_method_id: data.payment_method_id,
        cash_register_id:  activeRegister.id,
        amount_usd:        data.amount_usd,
        amount_bs:         amountBs,
        rate_used:         rateUsed,
        reference:         data.reference ?? null,
        notes:             data.notes ?? null,
        created_by:        session.userId,
      },
      select: {
        id: true, amount_usd: true, amount_bs: true,
        rate_used: true, reference: true, notes: true, created_at: true,
      },
    })

    /* Auto-mark as paid when fully settled */
    const totalPaid = await prisma.saleAbono.aggregate({
      where: { sale_id: data.sale_id },
      _sum: { amount_usd: true },
    })
    if (Number(totalPaid._sum.amount_usd ?? 0) >= Number(sale.total_usd) - 0.001) {
      await prisma.sale.update({
        where: { id: data.sale_id, business_id: session.businessId },
        data:  { status: 'paid', sold_at: new Date() },
      })
    }

    return NextResponse.json({
      ok:    true,
      abono: {
        ...abono,
        amount_usd: Number(abono.amount_usd),
        amount_bs:  Number(abono.amount_bs),
        rate_used:  Number(abono.rate_used),
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('POST /api/clients/[id]/abono:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
