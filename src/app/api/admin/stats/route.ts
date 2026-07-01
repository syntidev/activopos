import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REGISTRATIONS_WINDOW_DAYS = 30

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const now         = new Date()
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const windowStart = new Date(now.getTime() - REGISTRATIONS_WINDOW_DAYS * 86_400_000)

  const [total, trialCount, activeBusinessIds, salesMonth, recentBusinesses] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { catalog_plan: null } }),
    prisma.sale.findMany({
      where:    { status: 'paid', sold_at: { gte: windowStart } },
      select:   { business_id: true },
      distinct: ['business_id'],
    }),
    prisma.sale.aggregate({
      where:  { status: 'paid', sold_at: { gte: monthStart } },
      _sum:   { total_usd: true },
      _count: true,
    }),
    prisma.business.findMany({
      where:  { created_at: { gte: windowStart } },
      select: { created_at: true },
    }),
  ])

  const dailyMap = new Map<string, number>()
  for (const b of recentBusinesses) {
    const key = b.created_at.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }
  const registrationsByDay = Array.from({ length: REGISTRATIONS_WINDOW_DAYS }, (_, i) => {
    const d   = new Date(windowStart.getTime() + i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    return { date: key, count: dailyMap.get(key) ?? 0 }
  })

  return NextResponse.json({
    ok: true,
    totalTenants:       total,
    activeTenants30d:   activeBusinessIds.length,
    trialTenants:       trialCount,
    monthSalesUsd:      Number(salesMonth._sum.total_usd ?? 0),
    monthSalesCount:    salesMonth._count,
    registrationsByDay,
  })
}
