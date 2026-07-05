import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

type ChartPeriod = '7d' | '30d' | '12m'

const METHOD_COLORS: Record<string, string> = {
  cash:     '#22c55e',
  transfer: '#3b82f6',
  zelle:    '#f59e0b',
  binance:  '#f97316',
  card:     '#8b5cf6',
  other:    '#6b7280',
}

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

type DailyRow  = { date_label: string; total_usd: string; total_bs: string; profit: string | null; tx_count: string | number }
type MethodRow = { type: string; name: string; total_usd: string }
type TopRow    = { product_name: string; qty: string | number; total_usd: string | number }
type LowRow    = { cnt: string | number }
type RateRow   = { rate: string | number }

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const sp = req.nextUrl.searchParams
  const raw = sp.get('period') ?? '7d'
  const period: ChartPeriod = (['7d', '30d', '12m'] as const).includes(raw as ChartPeriod)
    ? (raw as ChartPeriod)
    : '7d'

  const bid = session.businessId
  const now = new Date()
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

  let from: Date
  let dateExpr: string
  let groupExpr: string

  if (period === '12m') {
    from      = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
    dateExpr  = "DATE_FORMAT(sold_at, '%Y-%m')"
    groupExpr = "DATE_FORMAT(sold_at, '%Y-%m')"
  } else {
    const days = period === '30d' ? 29 : 6
    from      = new Date(todayStart.getTime() - days * 86_400_000)
    // DATE_FORMAT fuerza retorno string desde mysql2; DATE(sold_at) devuelve
    // un objeto Date de JS que rompe label.split() en formatLabel.
    dateExpr  = "DATE_FORMAT(sold_at, '%Y-%m-%d')"
    groupExpr = "DATE_FORMAT(sold_at, '%Y-%m-%d')"
  }

  const fromIso = from.toISOString().slice(0, 19).replace('T', ' ')
  const toIso   = tomorrowStart.toISOString().slice(0, 19).replace('T', ' ')

  const [salesRows, methodRows, topRows, lowStockRow, opsToday, creditosAbiertos, cxcSales, rateRows] =
    await Promise.all([

      // Subquery interna agrupa por s.id — evita only_full_group_by en MariaDB
      prisma.$queryRawUnsafe<DailyRow[]>(`
        SELECT
          ${dateExpr} AS date_label,
          SUM(total_usd)       AS total_usd,
          SUM(total_bs)        AS total_bs,
          SUM(profit)          AS profit,
          COUNT(DISTINCT id)   AS tx_count
        FROM (
          SELECT
            s.id,
            s.sold_at,
            s.total_usd,
            s.total_bs,
            COALESCE(SUM(si.subtotal_usd - si.quantity * IFNULL(si.cost_per_unit_usd, 0)), 0) AS profit
          FROM sales s
          LEFT JOIN sale_items si ON si.sale_id = s.id
          WHERE s.business_id = ${bid}
            AND s.status      = 'paid'
            AND s.sold_at    >= '${fromIso}'
            AND s.sold_at     < '${toIso}'
          GROUP BY s.id, s.sold_at, s.total_usd, s.total_bs
        ) q
        GROUP BY ${groupExpr}
        ORDER BY ${groupExpr} ASC
      `),

      prisma.$queryRawUnsafe<MethodRow[]>(`
        SELECT pm.type, pm.name, SUM(sp.amount_usd) AS total_usd
        FROM sale_payments sp
        JOIN payment_methods pm ON pm.id = sp.payment_method_id
        JOIN sales s            ON s.id  = sp.sale_id
        WHERE s.business_id = ${bid}
          AND s.sold_at    >= '${fromIso}'
          AND s.sold_at     < '${toIso}'
        GROUP BY pm.type, pm.name
        ORDER BY total_usd DESC
      `),

      prisma.$queryRawUnsafe<TopRow[]>(`
        SELECT si.product_name, SUM(si.quantity) AS qty, SUM(si.subtotal_usd) AS total_usd
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ${bid}
          AND s.status      = 'paid'
          AND s.sold_at    >= '${fromIso}'
          AND s.sold_at     < '${toIso}'
        GROUP BY si.product_id, si.product_name
        ORDER BY total_usd DESC
        LIMIT 5
      `),

      prisma.$queryRawUnsafe<LowRow[]>(`
        SELECT COUNT(*) AS cnt
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(quantity) - SUM(waste) AS net_qty
          FROM inventory_entries
          WHERE business_id = ${bid}
          GROUP BY product_id
        ) inv ON inv.product_id = p.id
        WHERE p.business_id = ${bid}
          AND p.active      = 1
          AND p.min_stock   > 0
          AND COALESCE(inv.net_qty, 0) <= p.min_stock
      `),

      db.sale.aggregate({
        where:  { status: 'paid', sold_at: { gte: todayStart, lt: tomorrowStart } }, // business_id inyectado
        _sum:   { total_usd: true },
        _count: { id: true },
      }),

      db.sale.count({ where: { status: 'credit' } }), // business_id inyectado

      db.sale.findMany({
        where: { status: 'credit', client_id: { not: null } }, // business_id inyectado
        select: {
          id: true, ticket_number: true, total_usd: true, created_at: true,
          client: { select: { name: true } },
          abonos: { select: { amount_usd: true } },
        },
        orderBy: { created_at: 'asc' },
        take: 10,
      }),

      prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,
    ])

  const formatLabel = (label: string): string => {
    if (period === '12m') {
      // label = 'YYYY-MM' → nombre de mes en español
      const [, month] = label.split('-')
      return MONTHS_ES[parseInt(month, 10) - 1] ?? label
    }
    // label = 'YYYY-MM-DD' (DATE(sold_at)) → 'DD/MM'
    const parts = label.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : label
  }

  const bcvRate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50

  const cxcPendientes = cxcSales.map(s => {
    const abonado = s.abonos.reduce((acc, a) => acc + Number(a.amount_usd), 0)
    const saldo   = Math.max(0, Math.round((Number(s.total_usd) - abonado) * 100) / 100)
    const days    = Math.floor((Date.now() - s.created_at.getTime()) / 86_400_000)
    return {
      sale_id:       s.id,
      ticket_number: s.ticket_number,
      client_name:   s.client?.name ?? 'Sin cliente',
      total_usd:     Number(s.total_usd),
      abonado_usd:   Math.round(abonado * 100) / 100,
      saldo_usd:     saldo,
      days_pending:  days,
      vencido:       days > 30,
    }
  }).filter(c => c.saldo_usd > 0)

  return NextResponse.json({
    ok: true,
    period,
    bcvRate,
    ventas_linea: salesRows.map(r => ({
      date:     formatLabel(r.date_label),
      usd:      parseFloat(String(r.total_usd)) || 0,
      bs:       parseFloat(String(r.total_bs))  || 0,
      tx_count: parseInt(String(r.tx_count ?? 0)) || 0,
    })),
    utilidad_barras: salesRows.map(r => ({
      date: formatLabel(r.date_label),
      usd:  parseFloat(String(r.profit)) || 0,
    })),
    metodos_pie: methodRows.map(m => ({
      name:  m.name,
      value: parseFloat(String(m.total_usd)) || 0,
      color: METHOD_COLORS[m.type] ?? METHOD_COLORS['other'],
    })),
    top_products: topRows.map(r => ({
      name:      r.product_name,
      qty:       parseFloat(String(r.qty)) || 0,
      total_usd: parseFloat(String(r.total_usd)) || 0,
    })),
    low_stock_count: parseInt(String(lowStockRow[0]?.cnt ?? 0)) || 0,
    ops: {
      sales_hoy:         Number(opsToday._sum.total_usd ?? 0),
      sales_count_hoy:   opsToday._count.id,
      creditos_abiertos: creditosAbiertos,
    },
    cxc_pendientes: cxcPendientes,
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}