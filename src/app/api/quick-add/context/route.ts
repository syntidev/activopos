import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { quickAddRateLimited, requireQuickAdd } from '@/lib/quick-add'
import { quickAddContextLimiter } from '@/lib/rate-limit'
import { subcategoryChips } from '@/lib/subcategory'
import type { QuickAddContext } from '@/types/quick-add'

export async function GET(): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session
  const businessId = session.businessId
  const limited = await quickAddRateLimited(quickAddContextLimiter, session.userId)
  if (limited) return limited

  const [{ rate }, categories, subs] = await Promise.all([
    getActiveRate(businessId),
    prisma.category.findMany({
      where: { business_id: businessId, active: true },
      select: { id: true, name: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    }),
    prisma.product.findMany({
      where: { business_id: businessId, active: true, subcategory: { not: null } },
      select: { subcategory: true },
    }),
  ])
  const body: QuickAddContext = {
    rate,
    categories,
    subcategories: subcategoryChips(subs.map(s => s.subcategory)).map(c => c.label),
  }
  return NextResponse.json(body)
}
