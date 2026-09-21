import { NextRequest, NextResponse } from 'next/server'
import {
  RESERVA_INCLUDE,
  handleReservaError,
  parseSearchParam,
  requireReservasAccess,
  reservasBySearch,
  serializeReserva,
} from '@/lib/reservas'

const SEARCH_LIMIT = 20

// GET /api/reservas/search?q=juan 047 — búsqueda híbrida en UN solo texto:
// ticket_number, cliente_nombre y cliente_telefono a la vez (coincidencia parcial,
// cada palabra debe aparecer en algún campo). `ticket` se acepta como alias de `q`.
export async function GET(req: NextRequest) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { db } = access

    const params = req.nextUrl.searchParams
    const param = parseSearchParam(params.get('q') ?? params.get('ticket'))
    if (!param.ok) return NextResponse.json({ error: param.error }, { status: 400 })

    const rows = await db.reserva.findMany({
      where:   reservasBySearch(param.tokens),
      include: RESERVA_INCLUDE,
      orderBy: { id: 'asc' },
      take:    SEARCH_LIMIT,
    })

    return NextResponse.json({ ok: true, reservas: rows.map(serializeReserva) })
  } catch (err) {
    return handleReservaError(err, 'GET /api/reservas/search')
  }
}
