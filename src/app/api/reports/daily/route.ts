import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type TopProductRow = {
  product_id: number
  product_name: string
  quantity: string | number
  total_usd: string | number
}

type RateRow = { rate: string | number }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const dateStr =
    req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  if (!dateSchema.safeParse(dateStr).success) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const dayStart = new Date(year, month - 1, day)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)

  const [salesAgg, payments, topProductsRaw, rateRows] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        business_id: session.businessId,
        status: 'paid',
        sold_at: { gte: dayStart, lt: dayEnd },
      },
      _sum: { total_usd: true, total_bs: true },
      _count: { id: true },
    }),
    prisma.salePayment.findMany({
      where: {
        sale: {
          business_id: session.businessId,
          status: 'paid',
          sold_at: { gte: dayStart, lt: dayEnd },
        },
      },
      include: {
        payment_method: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.$queryRaw<TopProductRow[]>`
      SELECT si.product_id, si.product_name,
        SUM(si.quantity)    AS quantity,
        SUM(si.subtotal_usd) AS total_usd
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ${session.businessId}
        AND s.status = 'paid'
        AND s.sold_at >= ${dayStart}
        AND s.sold_at < ${dayEnd}
      GROUP BY si.product_id, si.product_name
      ORDER BY total_usd DESC
      LIMIT 5
    `,
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
      existing.totalBs += Number(p.amount_bs)
      existing.count++
    } else {
      pmMap.set(p.payment_method_id, {
        id: p.payment_method_id,
        name: p.payment_method.name,
        type: p.payment_method.type,
        totalUsd: Number(p.amount_usd),
        totalBs: Number(p.amount_bs),
        count: 1,
      })
    }
  }

  const rate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
  const r2   = (x: number) => Math.round(x * 100) / 100

  return NextResponse.json({
    ok: true,
    date: dateStr,
    rate,
    salesCount: salesAgg._count.id,
    totalUsd: Number(salesAgg._sum.total_usd ?? 0),
    totalBs: Number(salesAgg._sum.total_bs ?? 0),
    byPaymentMethod: Array.from(pmMap.values()),
    topProducts: topProductsRaw.map(p => {
      const tusd = Number(p.total_usd)
      return {
        productId: Number(p.product_id),
        name: p.product_name,
        quantity: Number(p.quantity),
        totalUsd: tusd,
        totalBs: r2(tusd * rate),
      }
    }),
  })
}
