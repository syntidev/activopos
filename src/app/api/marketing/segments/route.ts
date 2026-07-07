import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const segments = await prisma.segment.findMany({
    where: { active: true },
    orderBy: { sort_order: 'asc' },
    select: {
      slug: true,
      name: true,
      theme_key: true,
      tag_line: true,
      headline: true,
      mode: true,
    },
  })
  return NextResponse.json(segments)
}
