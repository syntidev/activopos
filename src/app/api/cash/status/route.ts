import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { REALIZED_SALE_STATUSES, cashRefundTotals, netSales } from '@/lib/sales-returns'

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const register = await db.cashRegister.findFirst({
      where: { closed_at: null }, // business_id inyectado por el tenant layer
      include: { cashier: { select: { name: true } } },
    })

    if (!register) return NextResponse.json({ isOpen: false })

    const [ventas, payments, movements, abonosAgg, refunds] = await Promise.all([
      // Ventas netas del turno -- fuente única (src/lib/sales-returns.ts).
      netSales(session.businessId, register.opened_at),

      // Pagos en efectivo del turno. Se piden aparte porque el efectivo
      // esperado depende del MÉTODO de cada pago, no del total de la venta.
      // SalePayment no tiene business_id — aislado por la relación sale.
      db.salePayment.findMany({
        where: {
          sale: {
            business_id: session.businessId,
            status:      { in: [...REALIZED_SALE_STATUSES] },
            sold_at:     { gte: register.opened_at },
          },
          payment_method: { type: 'cash' },
        },
        select: { amount_bs: true },
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

      // Reembolsos EN EFECTIVO pagados durante este turno.
      cashRefundTotals(session.businessId, register.opened_at),
    ])

    const cashVentasBs =
      payments.reduce((a, p) => a + Number(p.amount_bs), 0) - refunds.bs

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
        salesCount: ventas.salesCount,
        totalVentasBs: ventas.net.bs,
        totalVentasUsd: ventas.net.usd,
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
