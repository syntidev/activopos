import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import {
  RESERVA_INCLUDE,
  badRequest,
  buildFlagUpdate,
  handleReservaError,
  patchReservaSchema,
  requireReservasAccess,
  serializeReserva,
} from '@/lib/reservas'

// PATCH /api/reservas/[id] — cambia CUALQUIERA de las 3 banderas por separado:
//   { armado }  |  { entregado }  |  { pagado, pagado_monto, pagado_metodo }
// más { entregado_foto } (opcional, independiente; null la quita).
// Marcar una nunca toca las otras dos. Entregado NO exige foto; Pagado exige monto.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session, db } = access

    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const parsed = patchReservaSchema.safeParse(json)
    if (!parsed.success) return badRequest(parsed.error)

    // El tenant layer filtra por business_id: una reserva de otro negocio da null (404).
    const existing = await db.reserva.findFirst({
      where:  { id },
      select: { pagado_monto: true, pagado_metodo: true },
    })
    if (!existing) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

    const update = buildFlagUpdate(
      {
        pagado_monto:   existing.pagado_monto === null ? null : Number(existing.pagado_monto),
        pagado_metodo:  existing.pagado_metodo,
      },
      parsed.data,
      session.businessId,
    )
    if (!update.ok) return NextResponse.json({ error: update.error }, { status: 400 })

    // Independiente de las 3 banderas -- se procesa aparte, no via buildFlagUpdate.
    // Prisma.JsonNull (no `null` de JS) para borrar el desglose explícitamente;
    // omitido del objeto = no tocar la columna.
    const data: Prisma.ReservaUpdateInput = { ...update.data }
    if (parsed.data.componentes_tallas !== undefined) {
      data.componentes_tallas = parsed.data.componentes_tallas === null
        ? Prisma.JsonNull
        : parsed.data.componentes_tallas
    }

    const row = await db.reserva.update({
      where:   { id },
      data,
      include: RESERVA_INCLUDE,
    })

    return NextResponse.json({ ok: true, reserva: serializeReserva(row) })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    return handleReservaError(err, 'PATCH /api/reservas/[id]')
  }
}
