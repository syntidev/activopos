import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { onboardingLimiter, getClientIp } from '@/lib/rate-limit'

const SLUG_RE = /^[a-z0-9-]{3,50}$/

export async function GET(req: NextRequest) {
  try {
    await onboardingLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  const slug = req.nextUrl.searchParams.get('slug')

  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  const existing = await prisma.business.findFirst({
    where:  { catalog_slug: slug },
    select: { id: true },
  })

  return NextResponse.json({ available: !existing })
}
