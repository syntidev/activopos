import { NextRequest, NextResponse } from 'next/server'
import { buildReport, reportQuerySchema, resolveRange } from '@/lib/restaurante-reportes'
import { badRequest, handleRestauranteError, requireRestauranteAccess } from '@/lib/restaurante-server'

// GET /api/restaurante/reportes?from=AAAA-MM-DD&to=AAAA-MM-DD (admin) — ventas por mesonero y área, rotación, tiempos por estación (p50/p90)
// y propinas por mesonero. Las ventas salen netas de devoluciones y las propinas van SIEMPRE aparte (lib/sales-returns.ts).
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const q = reportQuerySchema.safeParse({ from: req.nextUrl.searchParams.get('from') ?? undefined, to: req.nextUrl.searchParams.get('to') ?? undefined })
    if (!q.success) return badRequest(q.error)
    const range = resolveRange(q.data.from, q.data.to)
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
    const report = await buildReport(access.db, access.session.businessId, range.from, range.to, range.start, range.end)
    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/reportes')
  }
}
