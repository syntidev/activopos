import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SLUG_RE = /^[a-z0-9-]{3,50}$/

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const segment = await prisma.segment.findFirst({
    where: { slug: params.slug, active: true },
    include: {
      faqs: { orderBy: { sort_order: 'asc' } },
    },
  })

  if (!segment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(segment)
}
