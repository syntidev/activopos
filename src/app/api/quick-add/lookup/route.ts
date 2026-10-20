import { NextRequest, NextResponse } from 'next/server'
import { quickAddLookupLimiter } from '@/lib/rate-limit'
import { CODE_RE, badRequest, findByBarcode, quickAddRateLimited, requireQuickAdd } from '@/lib/quick-add'
import { lookupLabelCaptureTitle } from '@/lib/title-lookup'
import type { QuickAddLookup } from '@/types/quick-add'

const SKU_LOOKUP_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{3,59}$/

/**
 * Código → producto que ya lo usa en el negocio, o si no, el título de las capturas del negocio.
 * Solo consulta la DB: el formulario se abre al instante. Las bases públicas van en /api/quick-add/title.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session

  const code = (req.nextUrl.searchParams.get('code') ?? '').replace(/\s+/g, ' ').trim()
  // Un barcode (CODE_RE) o un SKU, que puede llevar espacios ("21216H UNICO COLOR XS").
  const isBarcode = CODE_RE.test(code)
  if (!isBarcode && !SKU_LOOKUP_RE.test(code)) return badRequest('Código inválido')

  const limited = await quickAddRateLimited(quickAddLookupLimiter, session.userId)
  if (limited) return limited

  const existing = await findByBarcode(session.businessId, code, true)
  const title = existing || !isBarcode ? null : await lookupLabelCaptureTitle(session.businessId, code)
  const body: QuickAddLookup = { existing, title }
  return NextResponse.json(body)
}
