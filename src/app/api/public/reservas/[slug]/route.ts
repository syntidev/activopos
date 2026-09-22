import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendReservaConfirmationEmail } from '@/lib/mail'
import { reservaPublicLimiter, getClientIp } from '@/lib/rate-limit'
import {
  RESERVA_INCLUDE,
  TICKET_MAX_RETRIES,
  badRequest,
  createReservaBatchSchema,
  handleReservaError,
  nextTicketNumber,
  serializeReserva,
  ticketPrefixFromSlug,
  type ReservaRow,
} from '@/lib/reservas'

// POST /api/public/reservas/[slug] — landing pública (ej. /kit-200k), sin sesión.
// El negocio se resuelve por catalog_slug en vez de la sesión, y exige
// Business.reservas_enabled=true (el módulo debe estar habilitado explícitamente
// para este tenant — ver convención "MÓDULOS POR NEGOCIO" en CLAUDE.md).
//
// Pedido de N kits: crea N Reservas reales (una por kit, cada una con su
// propio ticket_number), todas dentro de una sola transacción (o se crean
// las N, o ninguna) y compartiendo un grupo_pedido (null si N=1 -- caso
// normal, sin agrupar nada). Un solo correo de confirmación lista todos los
// tickets del pedido. Las franelas sueltas (extras) son del PEDIDO, no de un
// kit en particular -- se guardan en la primera Reserva del grupo.
const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  try {
    await reservaPublicLimiter.consume(getClientIp(req) ?? 'unknown')
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 })
  }

  const business = await prisma.business.findFirst({
    where:  { catalog_slug: parsedSlug.data, active: true },
    select: { id: true, reservas_enabled: true },
  })
  if (!business || !business.reservas_enabled) {
    return NextResponse.json({ error: 'Reservas no disponibles' }, { status: 404 })
  }

  try {
    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const parsed = createReservaBatchSchema.safeParse(json)
    if (!parsed.success) return badRequest(parsed.error)
    const data = parsed.data

    const kit = await prisma.product.findFirst({
      where: { id: data.kit_id, business_id: business.id, product_type: 'combo', active: true },
      select: {
        id:   true,
        name: true,
        collections: {
          select:  { collection: { select: { slug: true } } },
          orderBy: { collection_id: 'asc' },
          take:    1,
        },
      },
    })
    if (!kit) {
      return NextResponse.json({ error: 'Kit no encontrado' }, { status: 404 })
    }

    const prefix = ticketPrefixFromSlug(kit.collections[0]?.collection.slug)
    // Medalla Finalista es fija por kit (Corrección 2: Maillot+Franela+Medias+
    // Medalla, sin toggle ni condición) -- se agrega acá, no la manda el
    // cliente. sharedExtras (franelas sueltas de Damas/Caballeros/Niños) SÍ
    // son elección del cliente y son del PEDIDO, no de un kit -- van solo en
    // la primera Reserva del grupo.
    const MEDALLA_EXTRA = { nombre: 'Medalla Finalista', cantidad: 1, talla: null }
    const sharedExtras = data.extras
      ? data.extras.map(e => ({ nombre: e.nombre, cantidad: e.cantidad, talla: e.talla ?? null }))
      : []
    const grupoPedido = data.kits.length > 1 ? randomUUID() : null

    let rows: ReservaRow[]
    try {
      rows = await prisma.$transaction(async tx => {
        const created: ReservaRow[] = []
        for (let kitIdx = 0; kitIdx < data.kits.length; kitIdx++) {
          const kitConfig = data.kits[kitIdx]
          let row: ReservaRow | null = null
          for (let attempt = 0; attempt < TICKET_MAX_RETRIES && !row; attempt++) {
            // Se refresca en cada intento (incluye lo ya creado en ESTA misma
            // transacción para los kits anteriores -- read-your-own-writes).
            const existing = await tx.reserva.findMany({
              where:  { business_id: business.id, ticket_number: { startsWith: `${prefix}-` } },
              select: { ticket_number: true },
            })
            const ticket = nextTicketNumber(prefix, existing.map(r => r.ticket_number))
            try {
              row = await tx.reserva.create({
                data: {
                  business_id:        business.id,
                  ticket_number:      ticket,
                  cliente_nombre:     data.cliente_nombre,
                  cliente_telefono:   data.cliente_telefono?.replace(/[^\d+]/g, '') || null,
                  cliente_cedula:     data.cliente_cedula,
                  cliente_correo:     data.cliente_correo,
                  grupo_pedido:       grupoPedido,
                  kit_id:             kit.id,
                  componentes_tallas: kitConfig.componentes_tallas,
                  cantidad:           1,
                  extras:             kitIdx === 0 ? [MEDALLA_EXTRA, ...sharedExtras] : [MEDALLA_EXTRA],
                },
                include: RESERVA_INCLUDE,
              })
            } catch (err) {
              if ((err as { code?: string }).code === 'P2002') continue
              throw err
            }
          }
          if (!row) throw new Error('NO_TICKET_AVAILABLE')
          created.push(row)
        }
        return created
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_TICKET_AVAILABLE') {
        return NextResponse.json({ error: 'No se pudo asignar un ticket, intenta de nuevo' }, { status: 409 })
      }
      throw err
    }

    // Resumen por kit: componentes_tallas (talla por pieza), mismo criterio
    // que ReservaCard muestra en el Kanban interno. Las franelas sueltas
    // (sharedExtras) van solo en el bloque del primer ticket -- son del
    // pedido, no se duplican por kit.
    const tickets = rows.map((row, i) => ({
      ticketNumber: row.ticket_number,
      resumen: [
        ...Object.entries(data.kits[i].componentes_tallas).map(([nombre, talla]) => ({ nombre, cantidad: 1, talla })),
        MEDALLA_EXTRA,
        ...(i === 0 ? sharedExtras : []),
      ],
    }))
    await sendReservaConfirmationEmail(data.cliente_correo, tickets, kit.name)

    return NextResponse.json({ ok: true, reservas: rows.map(serializeReserva) }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return badRequest(err)
    return handleReservaError(err, 'POST /api/public/reservas/[slug]')
  }
}
