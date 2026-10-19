import { NextRequest, NextResponse } from 'next/server'
import { quickAddLookupLimiter } from '@/lib/rate-limit'
import { CODE_RE, badRequest, findByBarcode, quickAddRateLimited, requireQuickAdd } from '@/lib/quick-add'
import { lookupTitle } from '@/lib/title-lookup'
import type { QuickAddLookup } from '@/types/quick-add'

/** Código → producto que ya lo usa en el negocio, o si no, el título que conocen las fuentes (sin foto). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session

  const code = (req.nextUrl.searchParams.get('code') ?? '').trim()
  if (!CODE_RE.test(code)) return badRequest('Código inválido')

  const limited = await quickAddRateLimited(quickAddLookupLimiter, session.userId)
  if (limited) return limited

  const existing = await findByBarcode(session.businessId, code)
  const title = existing ? null : await lookupTitle(session.businessId, code)
  const body: QuickAddLookup = { existing, title }
  return NextResponse.json(body)
}
