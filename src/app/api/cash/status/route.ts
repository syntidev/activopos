import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const register = await prisma.cashRegister.findFirst({
    where: { business_id: session.businessId, closed_at: null },
    include: { cashier: { select: { name: true } } },
  })

  if (!register) return NextResponse.json({ isOpen: false })

  const [sales, movements, abonosAgg] = await Promise.all([
    prisma.sale.findMany({
      where: {
        business_id: session.businessId,
        status: 'paid',
        sold_at: { gte: register.opened_at },
      },
      include: {
        payments: {
          include: { payment_method: { select: { type: true } } },
        },
      },
    }),
    prisma.cashMovement.findMany({
      where: { cash_register_id: register.id },
    }),
    prisma.saleAbono.aggregate({
      where: {
        created_at: { gte: register.opened_at },
        sale: { business_id: session.businessId },
      },
      _sum: { amount_usd: true, amount_bs: true },
      _count: { id: true },
    }),
  ])

  const totalVentasBs = sales.reduce((acc, s) => acc + Number(s.total_bs), 0)
  const totalVentasUsd = sales.reduce((acc, s) => acc + Number(s.total_usd), 0)

  const cashVentasBs = sales.reduce(
    (acc, s) =>
      acc +
      s.payments
        .filter(p => p.payment_method.type === 'cash')
        .reduce((a, p) => a + Number(p.amount_bs), 0),
    0
  )

  const movIn = movements
    .filter(m => m.type === 'in')
    .reduce((a, m) => a + Number(m.amount_bs), 0)

  const movOut = movements
    .filter(m => m.type === 'out')
    .reduce((a, m) => a + Number(m.amount_bs), 0)

  const efectivoEsperado =
    Number(register.opening_amount_bs) + cashVentasBs + movIn - movOut

  return NextResponse.json({
    isOpen: true,
    register: {
      id: register.id,
      openedAt: register.opened_at,
      cashierName: register.cashier.name,
      openingAmountBs: Number(register.opening_amount_bs),
      openingAmountUsd: Number(register.opening_amount_usd),
      rateAtOpen: Number(register.rate_at_open),
    },
    turnoStats: {
      salesCount: sales.length,
      totalVentasBs,
      totalVentasUsd,
      cashVentasBs,
      movIn,
      movOut,
      efectivoEsperado,
      cobrosCredito: {
        usd: Number(abonosAgg._sum.amount_usd ?? 0),
        bs:  Number(abonosAgg._sum.amount_bs  ?? 0),
        count: abonosAgg._count.id,
      },
    },
  })
}
