import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

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
  ] = await Promise.all([
    db.sale.aggregate({
      where: {
        // business_id inyectado por el tenant layer
        status:      'paid',
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
          status:      'paid',
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
          status:      'paid',
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
        AND s.status = 'paid'
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
        AND s.status = 'paid'
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
        AND status = 'paid'
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

  const rate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const r2   = (x: number) => Math.round(x * 100) / 100

  return NextResponse.json({
    ok:         true,
    date:       dateStr,
    rate,
    sales_count: salesAgg._count.id,
    items_sold:  Number(itemsAgg._sum.quantity ?? 0),
    total_usd:   Number(salesAgg._sum.total_usd ?? 0),
    total_bs:    Number(salesAgg._sum.total_bs ?? 0),
    by_payment_method: Array.from(pmMap.values()),
    by_category: byCategoryRaw.map(c => ({
      category:  c.category,
      total_usd: Number(c.total_usd),
      total_bs:  r2(Number(c.total_usd) * rate),
      qty:       Number(c.qty),
    })),
    hourly_sales: hourlyRaw.map(h => ({
      hour:      Number(h.hour),
      total_usd: Number(h.total_usd),
      count:     parseInt(String(h.count), 10),
    })),
    top_products: topProductsRaw.map(p => {
      const tusd = Number(p.total_usd)
      return {
        product_id: Number(p.product_id),
        name:       p.product_name,
        sku:        p.sku ?? null,
        category:   p.category ?? null,
        quantity:   Number(p.quantity),
        total_usd:  tusd,
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
