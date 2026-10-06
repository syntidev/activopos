import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { REALIZED_SALE_STATUSES, approvedReturnsInRange } from '@/lib/sales-returns'

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    if (session.role !== 'admin' && session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const params = req.nextUrl.searchParams
    const from = params.get('from')
    const to = params.get('to')

    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const toDate = to ? new Date(`${to}T23:59:59`) : new Date()

    const [registers, salesInPeriod, returnsInPeriod] = await Promise.all([
      db.cashRegister.findMany({
        where: {
          // business_id inyectado por el tenant layer
          closed_at: { not: null },
          opened_at: { gte: fromDate },
        },
        orderBy: { opened_at: 'desc' },
        include: {
          cashier: { select: { name: true } },
          movements: true,
        },
      }),
      db.sale.findMany({
        where: {
          // business_id inyectado por el tenant layer
          // partial_return incluido: antes una devolución de 1 unidad sacaba la
          // venta ENTERA del turno (ver lib/sales-returns.ts).
          status: { in: [...REALIZED_SALE_STATUSES] },
          sold_at: { gte: fromDate, lte: toDate },
        },
        include: {
          payments: {
            include: { payment_method: { select: { type: true } } },
          },
        },
      }),
      approvedReturnsInRange(session.businessId, fromDate, toDate),
    ])

    const history = registers.map(reg => {
      const regSales = salesInPeriod.filter(
        s =>
          s.sold_at &&
          s.sold_at >= reg.opened_at &&
          (!reg.closed_at || s.sold_at <= reg.closed_at)
      )

      const inThisRegister = (d: Date | null) =>
        !!d && d >= reg.opened_at && (!reg.closed_at || d <= reg.closed_at)

      // Devuelto de ventas DE ESTE turno -> ventas netas del turno.
      const returnedOfRegSales = returnsInPeriod
        .filter(r => inThisRegister(r.sold_at))
        .reduce((a, r) => ({ usd: a.usd + r.total_usd, bs: a.bs + r.total_bs }), { usd: 0, bs: 0 })

      // Reembolsado DURANTE este turno (puede ser de una venta de otro turno):
      // es cuando el dinero salió del cajón. Solo cuentan los reembolsos EN
      // EFECTIVO (estándar contable 2026-10-06, ver lib/sales-returns.ts).
      const refundedInRegister = returnsInPeriod
        .filter(r => r.is_cash && inThisRegister(r.refunded_at))
        .reduce((a, r) => a + r.total_bs, 0)

      const totalVentasBs = regSales.reduce((acc, s) => acc + Number(s.total_bs), 0) - returnedOfRegSales.bs
      const totalVentasUsd = regSales.reduce((acc, s) => acc + Number(s.total_usd), 0) - returnedOfRegSales.usd

      const cashVentasBs =
        regSales.reduce(
          (acc, s) =>
            acc +
            s.payments
              .filter(p => p.payment_method.type === 'cash')
              .reduce((a, p) => a + Number(p.amount_bs), 0),
          0
        ) - refundedInRegister

      const movIn = reg.movements
        .filter(m => m.type === 'in')
        .reduce((a, m) => a + Number(m.amount_bs), 0)

      const movOut = reg.movements
        .filter(m => m.type === 'out')
        .reduce((a, m) => a + Number(m.amount_bs), 0)

      const efectivoEsperado =
        Number(reg.opening_amount_bs) + cashVentasBs + movIn - movOut

      const efectivoContado = reg.closing_amount_bs
        ? Number(reg.closing_amount_bs)
        : null

      const diferencia =
        efectivoContado !== null ? efectivoContado - efectivoEsperado : null

      const countedUsd     = reg.closing_amount_usd ? Number(reg.closing_amount_usd) : null
      const differenceUsd  = countedUsd !== null
        ? Math.round((countedUsd - totalVentasUsd) * 100) / 100
        : null

      return {
        // Spec-required fields
        id:                 reg.id,
        opened_at:          reg.opened_at.toISOString(),
        closed_at:          reg.closed_at ? reg.closed_at.toISOString() : null,
        opening_amount_usd: Number(reg.opening_amount_usd),
        expected_usd:       Math.round(totalVentasUsd * 100) / 100,
        counted_usd:        countedUsd,
        difference_usd:     differenceUsd,
        sales_count:        regSales.length,
        // Extended fields
        openedAt: reg.opened_at,
        closedAt: reg.closed_at,
        cashierName: reg.cashier.name,
        openingAmountBs: Number(reg.opening_amount_bs),
        openingAmountUsd: Number(reg.opening_amount_usd),
        closingAmountBs: efectivoContado,
        closingAmountUsd: countedUsd,
        rateAtOpen: Number(reg.rate_at_open),
        closeNotes: reg.close_notes,
        salesCount: regSales.length,
        totalVentasBs,
        totalVentasUsd,
        efectivoEsperado,
        efectivoContado,
        diferencia,
      }
    })

    return NextResponse.json({ ok: true, history })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
