import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  RESERVAS_LIST_LIMIT,
  RESERVA_INCLUDE,
  TICKET_MAX_RETRIES,
  badRequest,
  createReservaSchema,
  handleReservaError,
  nextTicketNumber,
  parseCollectionParam,
  requireReservasAccess,
  reservasByCollection,
  serializeReserva,
  ticketPrefixFromSlug,
} from '@/lib/reservas'

// GET /api/reservas?collection=200k-2027 — reservas cuyo kit pertenece a la colección
export async function GET(req: NextRequest) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session, db } = access

    const param = parseCollectionParam(req.nextUrl.searchParams.get('collection'))
    if (!param.ok) return NextResponse.json({ error: param.error }, { status: 400 })

    const rows = await db.reserva.findMany({
      where:   reservasByCollection(param.slug, session.businessId),
      include: RESERVA_INCLUDE,
      orderBy: { id: 'asc' },
      take:    RESERVAS_LIST_LIMIT,
    })

    return NextResponse.json({ ok: true, reservas: rows.map(serializeReserva) })
  } catch (err) {
    return handleReservaError(err, 'GET /api/reservas')
  }
}

// POST /api/reservas — crea la reserva y le asigna un ticket correlativo ("200K-047")
export async function POST(req: NextRequest) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session, db } = access

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const parsed = createReservaSchema.safeParse(json)
    if (!parsed.success) return badRequest(parsed.error)
    const data = parsed.data

    // El kit es un producto combo del mismo negocio (el tenant layer ya filtra).
    const kit = await db.product.findFirst({
      where:  { id: data.kit_id, product_type: 'combo', active: true },
      select: {
        id: true,
        collections: {
          select:  { collection: { select: { slug: true } } },
          orderBy: { collection_id: 'asc' },
          take:    1,
        },
      },
    })
    if (!kit) {
      return NextResponse.json({ error: 'Kit no encontrado (debe ser un producto combo activo)' }, { status: 404 })
    }

    const prefix = ticketPrefixFromSlug(kit.collections[0]?.collection.slug)
    const extras = data.extras
      ? data.extras.map(e => ({ nombre: e.nombre, cantidad: e.cantidad, talla: e.talla ?? null }))
      : undefined

    // Dos altas simultáneas pueden calcular el mismo número: el índice único
    // (business_id, ticket_number) rechaza la segunda (P2002) y se reintenta.
    for (let attempt = 0; attempt < TICKET_MAX_RETRIES; attempt++) {
      const existing = await db.reserva.findMany({
        where:  { ticket_number: { startsWith: `${prefix}-` } },
        select: { ticket_number: true },
      })
      const ticket = nextTicketNumber(prefix, existing.map(r => r.ticket_number))

      try {
        const row = await db.reserva.create({
          data: {
            business_id:      session.businessId,
            ticket_number:    ticket,
            cliente_nombre:   data.cliente_nombre,
            // Solo dígitos y "+": "0414-111 22 33" y "04141112233" quedan iguales al buscar.
            cliente_telefono: data.cliente_telefono?.replace(/[^\d+]/g, '') || null,
            cliente_cedula:   data.cliente_cedula,
            cliente_correo:   data.cliente_correo,
            kit_id:             kit.id,
            talla:              data.talla || null,
            componentes_tallas: data.componentes_tallas ?? undefined,
            cantidad:           data.cantidad,
            extras,
          },
          include: RESERVA_INCLUDE,
        })
        return NextResponse.json({ ok: true, reserva: serializeReserva(row) }, { status: 201 })
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') continue
        throw err
      }
    }

    return NextResponse.json({ error: 'No se pudo asignar un ticket, intenta de nuevo' }, { status: 409 })
  } catch (err) {
    if (err instanceof z.ZodError) return badRequest(err)
    return handleReservaError(err, 'POST /api/reservas')
  }
}
