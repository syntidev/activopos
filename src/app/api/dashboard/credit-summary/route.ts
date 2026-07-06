import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const agg = await db.sale.aggregate({
      where: { status: 'pending' },
      _sum:  { total_usd: true },
      _count: true,
    })

    return NextResponse.json({
      ok:        true,
      total_usd: Number(agg._sum.total_usd ?? 0),
      count:     agg._count,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
