import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sort_order: 'asc' },
  })
  return NextResponse.json(plans)
}
