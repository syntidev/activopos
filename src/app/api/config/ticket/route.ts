import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { TicketConfig } from '@/types'

/* Los campos del panel viajan con nombre corto (show_bs) y se guardan con
   prefijo (ticket_show_bs), porque en `businesses` conviven con la config del
   catálogo y un `show_phone` pelado sería ambiguo. El mapeo vive acá y en
   ningún otro lado. */
const SELECT = {
  ticket_prefix:              true,
  ticket_footer:              true,
  ticket_format:              true,
  ticket_show_description:    true,
  ticket_show_bs:             true,
  ticket_show_foreign:        true,
  ticket_foreign_format:      true,
  ticket_show_address:        true,
  ticket_show_phone:          true,
  ticket_show_customer_data:  true,
  ticket_show_rif:            true,
  ticket_show_cashier_name:   true,
  ticket_show_bcv_rate:       true,
  ticket_show_payment_method: true,
} as const

type BusinessTicketRow = {
  ticket_prefix:              string
  ticket_footer:              string | null
  ticket_format:              string
  ticket_show_description:    boolean
  ticket_show_bs:             boolean
  ticket_show_foreign:        boolean
  ticket_foreign_format:      string
  ticket_show_address:        boolean
  ticket_show_phone:          boolean
  ticket_show_customer_data:  boolean
  ticket_show_rif:            boolean
  ticket_show_cashier_name:   boolean
  ticket_show_bcv_rate:       boolean
  ticket_show_payment_method: boolean
}

function toConfig(b: BusinessTicketRow): TicketConfig {
  return {
    ticket_prefix:       b.ticket_prefix,
    ticket_footer:       b.ticket_footer,
    ticket_format:       b.ticket_format as TicketConfig['ticket_format'],
    show_description:    b.ticket_show_description,
    show_bs:             b.ticket_show_bs,
    show_foreign:        b.ticket_show_foreign,
    foreign_format:      b.ticket_foreign_format as TicketConfig['foreign_format'],
    show_address:        b.ticket_show_address,
    show_phone:          b.ticket_show_phone,
    show_customer_data:  b.ticket_show_customer_data,
    show_rif:            b.ticket_show_rif,
    show_cashier_name:   b.ticket_show_cashier_name,
    show_bcv_rate:       b.ticket_show_bcv_rate,
    show_payment_method: b.ticket_show_payment_method,
  }
}

const PatchSchema = z.object({
  ticket_prefix:       z.string().max(10).optional(),
  ticket_footer:       z.string().nullable().optional(),
  ticket_format:       z.enum(['carta', '80mm', '58mm']).optional(),
  show_description:    z.boolean().optional(),
  show_bs:             z.boolean().optional(),
  show_foreign:        z.boolean().optional(),
  foreign_format:      z.enum(['usd', 'ref']).optional(),
  show_address:        z.boolean().optional(),
  show_phone:          z.boolean().optional(),
  show_customer_data:  z.boolean().optional(),
  show_rif:            z.boolean().optional(),
  show_cashier_name:   z.boolean().optional(),
  show_bcv_rate:       z.boolean().optional(),
  show_payment_method: z.boolean().optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Config de impresión: solo admin/super_admin. Consumido solo por la tab de Impresión,
  // bloqueada al cashier por middleware; este guard cierra el acceso por API directa.
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: SELECT,
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, ticket: toConfig(business) })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const current = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: SELECT,
  })
  if (!current) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  /* Un ticket sin ningún monto no es un ticket. El PATCH es parcial, así que
     el chequeo va contra el estado resultante, no contra el body: apagar
     show_bs cuando show_foreign ya venía apagado es igual de inválido que
     mandar los dos en false de una. */
  const nextBs      = data.show_bs      ?? current.ticket_show_bs
  const nextForeign = data.show_foreign ?? current.ticket_show_foreign
  if (!nextBs && !nextForeign) {
    return NextResponse.json(
      { error: 'El ticket debe mostrar al menos un monto: Bolívares o divisas' },
      { status: 400 },
    )
  }

  const updated = await prisma.business.update({
    where: { id: session.businessId },
    data: {
      ...(data.ticket_prefix       !== undefined && { ticket_prefix: data.ticket_prefix.toUpperCase() }),
      ...(data.ticket_footer       !== undefined && { ticket_footer:              data.ticket_footer }),
      ...(data.ticket_format       !== undefined && { ticket_format:              data.ticket_format }),
      ...(data.show_description    !== undefined && { ticket_show_description:    data.show_description }),
      ...(data.show_bs             !== undefined && { ticket_show_bs:             data.show_bs }),
      ...(data.show_foreign        !== undefined && { ticket_show_foreign:        data.show_foreign }),
      ...(data.foreign_format      !== undefined && { ticket_foreign_format:      data.foreign_format }),
      ...(data.show_address        !== undefined && { ticket_show_address:        data.show_address }),
      ...(data.show_phone          !== undefined && { ticket_show_phone:          data.show_phone }),
      ...(data.show_customer_data  !== undefined && { ticket_show_customer_data:  data.show_customer_data }),
      ...(data.show_rif            !== undefined && { ticket_show_rif:            data.show_rif }),
      ...(data.show_cashier_name   !== undefined && { ticket_show_cashier_name:   data.show_cashier_name }),
      ...(data.show_bcv_rate       !== undefined && { ticket_show_bcv_rate:       data.show_bcv_rate }),
      ...(data.show_payment_method !== undefined && { ticket_show_payment_method: data.show_payment_method }),
    },
    select: SELECT,
  })

  return NextResponse.json({ ok: true, ticket: toConfig(updated) })
}
