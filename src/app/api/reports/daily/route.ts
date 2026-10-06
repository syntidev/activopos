import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { REALIZED_SALE_STATUSES, returnedByCategory, returnedByProduct, returnedTotalsBySaleDate } from '@/lib/sales-returns'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type TopProductRow = {
  product_id:   number
  product_name: string
  sku:          string | null
  category:     string | null
  quantity:     string | number
  total_usd:    string | number
}

type CategoryRow = {
  category:  string | null
  total_usd: string | number
  qty:       string | number
}

type HourRow = {
  hour:      number
  total_usd: string | number
  count:     string | number
}

type RateRow = { rate: string | number }

// P2: sin rate limit explícito — si se agrega, usar Redis (ioredis + rate-limiter-flexible)
// para cluster-safety con PM2 multi-worker. RateLimiterMemory no comparte estado entre workers.
export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const dateStr =
    req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  if (!dateSchema.safeParse(dateStr).success) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const dayEnd   = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))

  const [
    salesAgg,
    itemsAgg,
    payments,
    topProductsRaw,
    byCategoryRaw,
    hourlyRaw,
    cashRegister,
    rateRows,
    returnedTotals,
    returnedProd,
    returnedCat,
    returnedHourlyRaw,
  ] = await Promise.all([
    db.sale.aggregate({
      where: {
        // business_id inyectado por el tenant layer
        // partial_return incluido y neteado abajo (ver lib/sales-returns.ts).
        status:      { in: [...REALIZED_SALE_STATUSES] },
        sold_at:     { gte: dayStart, lt: dayEnd },
      },
      _sum:   { total_usd: true, total_bs: true },
      _count: { id: true },
    }),

    // SaleItem no tiene business_id — aislado por la relación sale.business_id
    db.saleItem.aggregate({
      where: {
        sale: {
          business_id: session.businessId,
          status:      { in: [...REALIZED_SALE_STATUSES] },
          sold_at:     { gte: dayStart, lt: dayEnd },
        },
      },
      _sum: { quantity: true },
    }),

    // SalePayment no tiene business_id — aislado por la relación sale.business_id
    db.salePayment.findMany({
      where: {
        sale: {
          business_id: session.businessId,
          status:      { in: [...REALIZED_SALE_STATUSES] },
          sold_at:     { gte: dayStart, lt: dayEnd },
        },
      },
      include: {
        payment_method: { select: { id: true, name: true, type: true } },
      },
    }),

    prisma.$queryRaw<TopProductRow[]>`
      SELECT si.product_id,
             si.product_name,
             p.sku,
             c.name AS category,
             SUM(si.quantity)     AS quantity,
             SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.business_id = ${session.businessId}
        AND s.status IN ('paid','partial_return')
        AND s.sold_at >= ${dayStart}
        AND s.sold_at < ${dayEnd}
      GROUP BY si.product_id, si.product_name, p.sku, c.name
      ORDER BY total_usd DESC
      LIMIT 10
    `,

    prisma.$queryRaw<CategoryRow[]>`
      SELECT COALESCE(c.name, 'Sin categoría') AS category,
             SUM(si.subtotal_usd) AS total_usd,
             SUM(si.quantity)     AS qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.business_id = ${session.businessId}
        AND s.status IN ('paid','partial_return')
        AND s.sold_at >= ${dayStart}
        AND s.sold_at < ${dayEnd}
      GROUP BY c.name
      ORDER BY total_usd DESC
    `,

    prisma.$queryRaw<HourRow[]>`
      SELECT HOUR(sold_at) AS hour,
             SUM(total_usd) AS total_usd,
             COUNT(*) AS count
      FROM sales
      WHERE business_id = ${session.businessId}
        AND status IN ('paid','partial_return')
        AND sold_at >= ${dayStart}
        AND sold_at < ${dayEnd}
      GROUP BY HOUR(sold_at)
      ORDER BY hour ASC
    `,

    db.cashRegister.findFirst({
      where: {
        // business_id inyectado por el tenant layer
        opened_at:   { gte: dayStart, lt: dayEnd },
      },
      orderBy: { opened_at: 'desc' },
      select: {
        id:                   true,
        opening_amount_usd:   true,
        opening_amount_bs:    true,
        closing_amount_usd:   true,
        closing_amount_bs:    true,
        rate_at_open:         true,
        opened_at:            true,
        closed_at:            true,
        cashier: { select: { name: true } },
      },
    }),

    prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,

    returnedTotalsBySaleDate(session.businessId, dayStart, dayEnd),
    returnedByProduct(session.businessId, dayStart, dayEnd),
    returnedByCategory(session.businessId, dayStart, dayEnd),
    // Devuelto por HORA de la venta, con el MISMO HOUR(sold_at) de la serie.
    prisma.$queryRaw<{ hour: number; devuelto_usd: string | number }[]>`
      SELECT HOUR(s.sold_at) AS hour, SUM(r.total_usd) AS devuelto_usd
      FROM returns r JOIN sales s ON s.id = r.sale_id
      WHERE r.business_id = ${session.businessId}
        AND r.status = 'approved'
        AND s.status IN ('paid','partial_return')
        AND s.sold_at >= ${dayStart} AND s.sold_at < ${dayEnd}
      GROUP BY HOUR(s.sold_at)
    `,
  ])

  const pmMap = new Map<
    number,
    { id: number; name: string; type: string; totalUsd: number; totalBs: number; count: number }
  >()

  for (const p of payments) {
    const existing = pmMap.get(p.payment_method_id)
    if (existing) {
      existing.totalUsd += Number(p.amount_usd)
      existing.totalBs  += Number(p.amount_bs)
      existing.count++
    } else {
      pmMap.set(p.payment_method_id, {
        id:       p.payment_method_id,
        name:     p.payment_method.name,
        type:     p.payment_method.type,
        totalUsd: Number(p.amount_usd),
        totalBs:  Number(p.amount_bs),
        count:    1,
      })
    }
  }

  // El reembolso se asume en efectivo (decisión 2026-10-06, Return no guarda
  // método): se descuenta del bucket de tipo 'cash' para que la suma por método
  // siga cuadrando con el total neto. Si ese día no hubo ningún método de tipo
  // cash, no se inventa bucket: queda la diferencia y se ve en el total.
  if (returnedTotals.usd > 0) {
    const cashBucket = Array.from(pmMap.values()).find(m => m.type === 'cash')
    if (cashBucket) {
      cashBucket.totalUsd -= returnedTotals.usd
      cashBucket.totalBs  -= returnedTotals.bs
    }
  }

  const devueltoPorHora = new Map(returnedHourlyRaw.map(h => [Number(h.hour), Number(h.devuelto_usd)]))

  const rate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const r2   = (x: number) => Math.round(x * 100) / 100

  return NextResponse.json({
    ok:         true,
    date:       dateStr,
    rate,
    sales_count: salesAgg._count.id,
    items_sold:  Number(itemsAgg._sum.quantity ?? 0) - Array.from(returnedProd.values()).reduce((a, v) => a + v.qty, 0),
    total_usd:   r2(Number(salesAgg._sum.total_usd ?? 0) - returnedTotals.usd),
    total_bs:    r2(Number(salesAgg._sum.total_bs ?? 0) - returnedTotals.bs),
    by_payment_method: Array.from(pmMap.values()),
    by_category: byCategoryRaw.map(c => {
      const key  = c.category ?? 'Sin categoría'
      const back = returnedCat.get(key) ?? { usd: 0, qty: 0 }
      const net  = Number(c.total_usd) - back.usd
      return {
        category:  c.category,
        total_usd: r2(net),
        total_bs:  r2(net * rate),
        qty:       Number(c.qty) - back.qty,
      }
    }),
    hourly_sales: hourlyRaw.map(h => ({
      hour:      Number(h.hour),
      total_usd: r2(Number(h.total_usd) - (devueltoPorHora.get(Number(h.hour)) ?? 0)),
      count:     parseInt(String(h.count), 10),
    })),
    top_products: topProductsRaw.map(p => {
      const pid  = Number(p.product_id)
      const back = returnedProd.get(pid) ?? { usd: 0, qty: 0 }
      const tusd = Number(p.total_usd) - back.usd
      return {
        product_id: pid,
        name:       p.product_name,
        sku:        p.sku ?? null,
        category:   p.category ?? null,
        quantity:   Number(p.quantity) - back.qty,
        total_usd:  r2(tusd),
        total_bs:   r2(tusd * rate),
      }
    }),
    cash_register: cashRegister
      ? {
          id:                  cashRegister.id,
          cashier_name:        cashRegister.cashier.name,
          opening_amount_usd:  Number(cashRegister.opening_amount_usd),
          opening_amount_bs:   Number(cashRegister.opening_amount_bs),
          closing_amount_usd:  cashRegister.closing_amount_usd != null ? Number(cashRegister.closing_amount_usd) : null,
          closing_amount_bs:   cashRegister.closing_amount_bs  != null ? Number(cashRegister.closing_amount_bs)  : null,
          rate_at_open:        Number(cashRegister.rate_at_open),
          opened_at:           cashRegister.opened_at,
          closed_at:           cashRegister.closed_at,
        }
      : null,
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
