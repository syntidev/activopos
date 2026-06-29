import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const register = await db.cashRegister.findFirst({
      where: { closed_at: null }, // business_id inyectado por el tenant layer
      include: { cashier: { select: { name: true } } },
    })

    if (!register) return NextResponse.json({ isOpen: false })

    const [sales, movements, abonosAgg] = await Promise.all([
      db.sale.findMany({
        where: {
          // business_id inyectado por el tenant layer
          status: 'paid',
          sold_at: { gte: register.opened_at },
        },
        include: {
          payments: {
            include: { payment_method: { select: { type: true } } },
          },
        },
      }),
      db.cashMovement.findMany({
        where: { cash_register_id: register.id }, // business_id inyectado
      }),
      // SaleAbono no tiene business_id — aislado por la relación sale.business_id
      db.saleAbono.aggregate({
        where: {
          created_at: { gte: register.opened_at },
          sale: { business_id: session.businessId },
        },
        _sum: { amount_usd: true, amount_bs: true },
        _count: { _all: true },
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
          usd: Number(abonosAgg._sum?.amount_usd ?? 0),
          bs:  Number(abonosAgg._sum?.amount_bs  ?? 0),
          count: abonosAgg._count._all,
        },
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
