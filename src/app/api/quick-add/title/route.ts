import { NextRequest, NextResponse } from 'next/server'
import { quickAddLookupLimiter } from '@/lib/rate-limit'
import { CODE_RE, badRequest, quickAddRateLimited, requireQuickAdd } from '@/lib/quick-add'
import { lookupPublicTitle } from '@/lib/title-lookup'
import type { TitleHit } from '@/types/quick-add'

/**
 * Título del código en las bases públicas (en paralelo, tope de 2 s). Va aparte de /lookup para que el
 * formulario se abra sin esperarlas; el cliente solo lo usa si el campo sigue vacío.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session

  const code = (req.nextUrl.searchParams.get('code') ?? '').trim()
  if (!CODE_RE.test(code)) return badRequest('Código inválido')

  const limited = await quickAddRateLimited(quickAddLookupLimiter, session.userId)
  if (limited) return limited

  const title: TitleHit | null = await lookupPublicTitle(code)
  return NextResponse.json({ title })
}
