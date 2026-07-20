import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'

type Context = { params: { id: string } }

const EDITABLE_STATUSES = ['draft', 'sent'] as const

const ItemSchema = z.object({
  product_id:   z.number().int().positive().optional(),
  name:         z.string().min(1).max(120),
  qty:          z.number().positive(),
  price_usd:    z.number().nonnegative(),
  discount_pct: z.number().min(0).max(100).optional(),
})

// Total de línea con descuento aplicado. Mismo cálculo en POST (../route.ts):
// no se comparte porque un route.ts de App Router solo admite exports conocidos.
const lineTotal = (qty: number, price: number, pct?: number): number =>
  Math.round(qty * price * (1 - (pct ?? 0) / 100) * 100) / 100

const PatchSchema = z.object({
  status:      z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  notes:       z.string().max(2000).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  client_id:   z.number().int().positive().nullable().optional(),
  items:       z.array(ItemSchema).min(1).max(100).optional(),
})

const INCLUDE = {
  client: { select: { id: true, name: true, phone: true, email: true } },
  items:  true,
} as const

function formatQ(q: Awaited<ReturnType<typeof findQ>>) {
  if (!q) return null
  return {
    ...q,
    subtotal_usd: Number(q.subtotal_usd),
    total_usd:    Number(q.total_usd),
    total_bs:     Number(q.total_bs),
    rate_used:    Number(q.rate_used),
    items: q.items.map(i => ({
      ...i,
      qty:       Number(i.qty),
      price_usd: Number(i.price_usd),
      total_usd: Number(i.total_usd),
    })),
  }
}

async function findQ(db: TenantPrisma, id: number) {
  return db.quotation.findFirst({
    where:   { id }, // business_id inyectado por el tenant layer
    include: INCLUDE,
  })
}

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Auto-expire if past valid_until (business_id inyectado por el tenant layer)
    await db.quotation.updateMany({
      where: { id, status: { in: ['draft', 'sent'] }, valid_until: { lt: new Date() } },
      data:  { status: 'expired' },
    })

    const q = await findQ(db, id)
    if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    return NextResponse.json({ ok: true, quotation: formatQ(q) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = PatchSchema.parse(await req.json())

    const existing = await db.quotation.findFirst({ where: { id } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

    // Verify client belongs to this business before writing (fuera del $transaction)
    if (body.client_id !== undefined && body.client_id !== null) {
      const owned = await db.client.findFirst({
        where: { id: body.client_id }, // business_id inyectado
        select: { id: true },
      })
      if (!owned) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
    }

    // Content edits only allowed on draft/sent
    const hasContentEdit = body.items !== undefined || body.notes !== undefined ||
      body.valid_until !== undefined || body.client_id !== undefined
    if (hasContentEdit && !EDITABLE_STATUSES.includes(existing.status as typeof EDITABLE_STATUSES[number])) {
      return NextResponse.json({ error: 'Solo se puede editar cotizaciones en estado draft o sent' }, { status: 409 })
    }

    const r2 = (x: number) => Math.round(x * 100) / 100

    // $transaction en prisma base: business_id manual adentro
    const quotation = await prisma.$transaction(async tx => {
      if (body.items) {
        await tx.quotationItem.deleteMany({ where: { quotation_id: id } })
        const { rate } = await getActiveRate(session.businessId)
        const subtotal = body.items.reduce((s, i) => s + lineTotal(i.qty, i.price_usd, i.discount_pct), 0)
        await tx.quotationItem.createMany({
          data: body.items.map(i => ({
            quotation_id: id,
            product_id:   i.product_id,
            name:         i.name,
            qty:          i.qty,
            price_usd:    i.price_usd,
            discount_pct: i.discount_pct,
            total_usd:    lineTotal(i.qty, i.price_usd, i.discount_pct),
          })),
        })
        return tx.quotation.update({
          where: { id },
          data: {
            status:       body.status,
            notes:        body.notes,
            valid_until:  body.valid_until !== undefined
              ? (body.valid_until ? new Date(body.valid_until) : null) : undefined,
            client_id:    body.client_id,
            subtotal_usd: r2(subtotal),
            total_usd:    r2(subtotal),
            rate_used:    rate,
            total_bs:     r2(subtotal * rate),
          },
          include: INCLUDE,
        })
      }
      return tx.quotation.update({
        where: { id },
        data: {
          status:      body.status,
          notes:       body.notes,
          valid_until: body.valid_until !== undefined
            ? (body.valid_until ? new Date(body.valid_until) : null) : undefined,
          client_id:   body.client_id,
        },
        include: INCLUDE,
      })
    })

    return NextResponse.json({ ok: true, quotation: formatQ(quotation) })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('quotations PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.quotation.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
      select: { id: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Solo se pueden eliminar cotizaciones en estado draft' }, { status: 409 })
    }

    await db.quotation.delete({ where: { id } }) // business_id inyectado por el tenant layer
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
