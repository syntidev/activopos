import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

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

    const [registers, salesInPeriod] = await Promise.all([
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
          status: 'paid',
          sold_at: { gte: fromDate, lte: toDate },
        },
        include: {
          payments: {
            include: { payment_method: { select: { type: true } } },
          },
        },
      }),
    ])

    const history = registers.map(reg => {
      const regSales = salesInPeriod.filter(
        s =>
          s.sold_at &&
          s.sold_at >= reg.opened_at &&
          (!reg.closed_at || s.sold_at <= reg.closed_at)
      )

      const totalVentasBs = regSales.reduce((acc, s) => acc + Number(s.total_bs), 0)
      const totalVentasUsd = regSales.reduce((acc, s) => acc + Number(s.total_usd), 0)

      const cashVentasBs = regSales.reduce(
        (acc, s) =>
          acc +
          s.payments
            .filter(p => p.payment_method.type === 'cash')
            .reduce((a, p) => a + Number(p.amount_bs), 0),
        0
      )

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
