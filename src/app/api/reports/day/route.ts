import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

interface CategoryRow {
  category:    string
  vendido_usd: string | number
  costo_usd:   string | number
}

interface PaymentRow {
  method:    string
  cnt:       string | bigint
  total_usd: string | number
}

interface CostRow {
  costo_usd: string | null
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const dateStr = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!dateSchema.safeParse(dateStr).success) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const [year, month, dayNum] = dateStr.split('-').map(Number) as [number, number, number]
  const dayStart = new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0, 0))
  const dayEnd   = new Date(Date.UTC(year, month - 1, dayNum + 1, 0, 0, 0, 0))
  const bid      = session.businessId

  const [paidAgg, creditAgg, costRow, byCategoryRaw, paymentMethodsRaw, registers, salesForRegs] =
    await Promise.all([
      db.sale.aggregate({
        where: { status: 'paid', sold_at: { gte: dayStart, lt: dayEnd } }, // business_id inyectado
        _sum:  { total_usd: true, total_bs: true },
      }),

      db.sale.aggregate({
        where: { status: 'credit', created_at: { gte: dayStart, lt: dayEnd } }, // business_id inyectado
        _sum:  { total_usd: true },
      }),

      prisma.$queryRaw<CostRow[]>`
        SELECT SUM(si.quantity * IFNULL(p.cost_per_unit_usd, 0)) AS costo_usd
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE s.business_id = ${bid}
          AND s.status = 'paid'
          AND s.sold_at >= ${dayStart}
          AND s.sold_at < ${dayEnd}`,

      prisma.$queryRaw<CategoryRow[]>`
        SELECT COALESCE(c.name, 'Sin categoría')                    AS category,
               SUM(si.subtotal_usd)                                  AS vendido_usd,
               SUM(si.quantity * IFNULL(p.cost_per_unit_usd, 0))     AS costo_usd
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.business_id = ${bid}
          AND s.status = 'paid'
          AND s.sold_at >= ${dayStart}
          AND s.sold_at < ${dayEnd}
        GROUP BY COALESCE(c.name, 'Sin categoría')
        ORDER BY vendido_usd DESC`,

      prisma.$queryRaw<PaymentRow[]>`
        SELECT pm.name AS method, COUNT(*) AS cnt, SUM(sp.amount_usd) AS total_usd
        FROM sale_payments sp
        JOIN payment_methods pm ON pm.id = sp.payment_method_id
        JOIN sales s ON s.id = sp.sale_id
        WHERE s.business_id = ${bid}
          AND s.sold_at >= ${dayStart}
          AND s.sold_at < ${dayEnd}
        GROUP BY pm.id, pm.name
        ORDER BY total_usd DESC`,

      db.cashRegister.findMany({
        where:   { opened_at: { gte: dayStart, lt: dayEnd } }, // business_id inyectado
        select:  { id: true, opened_at: true, closed_at: true },
        orderBy: { opened_at: 'asc' },
      }),

      db.sale.findMany({
        where:  { status: 'paid', sold_at: { gte: dayStart, lt: dayEnd } }, // business_id inyectado
        select: { sold_at: true, total_usd: true },
      }),
    ])

  const cobrado_usd     = Number(paidAgg._sum.total_usd ?? 0)
  const total_bs        = Number(paidAgg._sum.total_bs  ?? 0)
  const credito_usd     = Number(creditAgg._sum.total_usd ?? 0)
  const total_usd       = cobrado_usd + credito_usd
  const costo_invertido = parseFloat(String(costRow[0]?.costo_usd ?? '0')) || 0
  const utilidad_usd    = cobrado_usd - costo_invertido
  const margen_pct      = cobrado_usd > 0
    ? Math.round((utilidad_usd / cobrado_usd) * 10000) / 100
    : 0

  const r2 = (x: number) => Math.round(x * 100) / 100

  return NextResponse.json({
    ok:   true,
    date: dateStr,
    summary: {
      cobrado_usd,
      credito_usd,
      total_usd,
      total_bs,
      utilidad_usd:        r2(utilidad_usd),
      costo_invertido_usd: r2(costo_invertido),
      margen_pct,
    },
    by_category: byCategoryRaw.map(c => {
      const vendido = Number(c.vendido_usd)
      const costo   = Number(c.costo_usd)
      const util    = vendido - costo
      return {
        category:     c.category,
        vendido_usd:  vendido,
        costo_usd:    r2(costo),
        utilidad_usd: r2(util),
        margen_pct:   vendido > 0 ? Math.round((util / vendido) * 10000) / 100 : 0,
      }
    }),
    payment_methods: paymentMethodsRaw.map(m => ({
      method:    m.method,
      count:     Number(m.cnt),
      total_usd: Number(m.total_usd),
    })),
    cash_registers: registers.map(reg => {
      const regSales = salesForRegs.filter(
        s => s.sold_at && s.sold_at >= reg.opened_at && (!reg.closed_at || s.sold_at <= reg.closed_at)
      )
      return {
        opened_at:   reg.opened_at.toISOString(),
        closed_at:   reg.closed_at ? reg.closed_at.toISOString() : null,
        sales_count: regSales.length,
        total_usd:   r2(regSales.reduce((a, s) => a + Number(s.total_usd), 0)),
      }
    }),
  })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
