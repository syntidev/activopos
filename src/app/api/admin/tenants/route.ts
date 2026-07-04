import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [businesses, salesCounts] = await Promise.all([
    prisma.business.findMany({
      select: {
        id:                      true,
        name:                    true,
        catalog_plan:            true,
        active:                  true,
        subscription_active:     true,
        subscription_expires_at: true,
        created_at:              true,
        users:                   { where: { role: 'admin' }, select: { email: true }, take: 1 },
        _count:                  { select: { products: true, users: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.sale.groupBy({
      by:     ['business_id'],
      where:  { status: 'paid', sold_at: { gte: monthStart } },
      _count: { _all: true },
    }),
  ])

  const salesMap = new Map(salesCounts.map(s => [s.business_id, s._count._all]))

  const tenants = businesses.map(b => ({
    id:                    b.id,
    name:                  b.name,
    adminEmail:            b.users[0]?.email ?? null,
    plan:                  b.catalog_plan ?? 'trial',
    active:                b.active,
    subscriptionActive:    b.subscription_active,
    subscriptionExpiresAt: b.subscription_expires_at,
    createdAt:             b.created_at,
    productCount:          b._count.products,
    userCount:             b._count.users,
    salesThisMonth:        salesMap.get(b.id) ?? 0,
  }))

  return NextResponse.json({ ok: true, tenants })
}
