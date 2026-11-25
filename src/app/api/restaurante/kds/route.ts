import { NextRequest, NextResponse } from 'next/server'
import { loadBoard, requireKdsAccess } from '@/lib/restaurante-kds'
import { handleRestauranteError } from '@/lib/restaurante-server'

// GET /api/restaurante/kds?station=<id|todas>&since=<ISO> — comandas de las estaciones permitidas. Sin precios.
export async function GET(req: NextRequest) {
  try {
    const access = await requireKdsAccess()
    if (access instanceof NextResponse) return access
    const q = req.nextUrl.searchParams
    const rawStation = q.get('station') ?? 'todas'
    const station = rawStation === 'todas' ? 'todas' : Number(rawStation)
    if (station !== 'todas' && (!Number.isInteger(station) || station <= 0)) return NextResponse.json({ error: 'Estación inválida' }, { status: 400 })
    const rawSince = q.get('since')
    const since = rawSince ? new Date(rawSince) : null
    if (since !== null && Number.isNaN(since.getTime())) return NextResponse.json({ error: 'Cursor inválido' }, { status: 400 })

    const board = await loadBoard(access.db, access.session.businessId, access, station, since)
    return NextResponse.json({ ok: true, ...board }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/kds')
  }
}
