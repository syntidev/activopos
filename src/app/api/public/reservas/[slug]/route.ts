import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendReservaConfirmationEmail } from '@/lib/mail'
import { reservaPublicLimiter, getClientIp } from '@/lib/rate-limit'
import {
  RESERVA_INCLUDE,
  TICKET_MAX_RETRIES,
  badRequest,
  createReservaSchema,
  handleReservaError,
  nextTicketNumber,
  serializeReserva,
  ticketPrefixFromSlug,
} from '@/lib/reservas'

// POST /api/public/reservas/[slug] — landing pública (ej. /kit-200k), sin sesión.
// Mismo schema/lógica de ticket que POST /api/reservas (requireReservasAccess),
// pero el negocio se resuelve por catalog_slug en vez de la sesión, y exige
// Business.reservas_enabled=true (el módulo debe estar habilitado explícitamente
// para este tenant — ver convención "MÓDULOS POR NEGOCIO" en CLAUDE.md).
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
    const parsed = createReservaSchema.safeParse(json)
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
    const extras = data.extras
      ? data.extras.map(e => ({ nombre: e.nombre, cantidad: e.cantidad, talla: e.talla ?? null }))
      : undefined

    for (let attempt = 0; attempt < TICKET_MAX_RETRIES; attempt++) {
      const existing = await prisma.reserva.findMany({
        where:  { business_id: business.id, ticket_number: { startsWith: `${prefix}-` } },
        select: { ticket_number: true },
      })
      const ticket = nextTicketNumber(prefix, existing.map(r => r.ticket_number))

      try {
        const row = await prisma.reserva.create({
          data: {
            business_id:      business.id,
            ticket_number:    ticket,
            cliente_nombre:   data.cliente_nombre,
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
        // Resumen: componentes_tallas (talla por pieza) + extras sueltos --
        // mismo criterio que ReservaCard muestra en el Kanban interno.
        const resumen = [
          ...Object.entries(data.componentes_tallas ?? {}).map(([nombre, talla]) => ({ nombre, cantidad: 1, talla })),
          ...(extras ?? []),
        ]
        await sendReservaConfirmationEmail(data.cliente_correo, ticket, kit.name, resumen)
        return NextResponse.json({ ok: true, reserva: serializeReserva(row) }, { status: 201 })
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') continue
        throw err
      }
    }

    return NextResponse.json({ error: 'No se pudo asignar un ticket, intenta de nuevo' }, { status: 409 })
  } catch (err) {
    if (err instanceof z.ZodError) return badRequest(err)
    return handleReservaError(err, 'POST /api/public/reservas/[slug]')
  }
}
