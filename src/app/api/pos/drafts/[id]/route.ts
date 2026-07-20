import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { draftItemSchema } from '@/lib/draft-schema'
import { checkAndIncrementPinAttempts, clearPinAttempts, verifyPin } from '@/lib/pin-rate-limit'
import { redactSaleForRole } from '@/lib/redact'

const patchItemSchema = draftItemSchema.extend({
  unit_price_override: z.number().positive().optional(),
  override_reason:     z.string().max(255).optional(),
})

const patchSchema = z.object({
  items:             z.array(patchItemSchema).min(0),
  notes:             z.string().max(500).optional(),
  override_auth_pin: z.string().min(1).max(20).optional(),
})

type Context = { params: { id: string } }

/* ── PATCH /api/pos/drafts/[id] — replace items in a draft ── */

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const draftId = parseInt(params.id, 10)
  if (isNaN(draftId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = patchSchema.parse(await req.json())

    // Validate price override authorization before the transaction
    const hasOverride = body.items.some(i => i.unit_price_override != null)
    if (hasOverride && session.role === 'cashier') {
      if (!body.override_auth_pin) {
        return NextResponse.json(
          { error: 'Se requiere PIN de administrador para modificar precios' },
          { status: 403 }
        )
      }
      // Rate limit keyed on userId — draftId would allow bypass by rotating drafts
      const limited = await checkAndIncrementPinAttempts(session.businessId, session.userId)
      if (limited) {
        return NextResponse.json(
          { error: 'Demasiados intentos. Espere 5 minutos.' },
          { status: 429 }
        )
      }
      const authorizer = await verifyPin(session.businessId, body.override_auth_pin)
      if (!authorizer) {
        return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
      }
      if (authorizer.role === 'cashier') {
        return NextResponse.json(
          { error: 'El PIN ingresado no corresponde a un administrador' },
          { status: 403 }
        )
      }
      await clearPinAttempts(session.businessId, session.userId)
    }

    // FIX 3: active rate fetched before transaction — avoids holding pool connection during network call
    const { rate } = await getActiveRate(session.businessId)

    const draft = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: draftId, business_id: session.businessId, cashier_id: session.userId, status: 'draft' },
      })
      if (!existing) throw new Error('NOT_FOUND')

      // Fetch prices from DB (anti-tampering)
      let saleItemsData: {
        product_id: number; product_name: string; sale_mode: string; unit_label: string
        quantity: number; price_per_unit_usd: number; cost_per_unit_usd: number; subtotal_usd: number
        subtotal_bs: number; rate_used: number; discount_usd: number; variant_id?: number
        unit_price_override?: number | null; override_reason?: string | null
      }[] = []

      if (body.items.length > 0) {
        const productIds = Array.from(new Set(body.items.map(i => i.product_id)))
        const products   = await tx.product.findMany({
          where:  { id: { in: productIds }, business_id: session.businessId, active: true },
          select: { id: true, name: true, sale_mode: true, unit_label: true, price_per_unit_usd: true, price_per_kg_usd: true, cost_per_unit_usd: true },
        })
        if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND')
        const productMap = new Map(products.map(p => [p.id, p]))

        saleItemsData = body.items.map(item => {
          const p        = productMap.get(item.product_id)!
          const dbPrice  = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
          const priceUsd = item.unit_price_override ?? dbPrice
          if (priceUsd <= 0) throw new Error('PRICE_MISSING')
          const subtotal_usd = Math.max(0, item.quantity * priceUsd - item.discount_usd)
          return {
            product_id:          item.product_id,
            product_name:        p.name,
            sale_mode:           p.sale_mode,
            unit_label:          p.unit_label,
            quantity:            item.quantity,
            price_per_unit_usd:  priceUsd,
            cost_per_unit_usd:   Number(p.cost_per_unit_usd ?? 0),
            subtotal_usd:        Math.round(subtotal_usd * 100) / 100,
            subtotal_bs:         Math.round(subtotal_usd * rate * 100) / 100,
            rate_used:           rate,
            discount_usd:        item.discount_usd,
            unit_price_override: item.unit_price_override ?? null,
            override_reason:     item.override_reason ?? null,
            ...(item.variant_id != null && { variant_id: item.variant_id }),
          }
        })
      }

      const total_usd = saleItemsData.reduce((acc, i) => acc + i.subtotal_usd, 0)
      const total_bs  = Math.round(total_usd * rate * 100) / 100

      // Replace items atomically
      await tx.saleItem.deleteMany({ where: { sale_id: draftId } })

      return tx.sale.update({
        where: { id: draftId },
        data:  {
          total_usd,
          total_bs,
          rate_used: rate,
          notes:     body.notes ?? existing.notes,
          ...(saleItemsData.length > 0 && {
            items: { create: saleItemsData },
          }),
        },
        include: { items: true },
      })
    })

    return NextResponse.json({ ok: true, draft: redactSaleForRole(draft, session.role) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND')         return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
      if (err.message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
      if (err.message === 'PRICE_MISSING')     return NextResponse.json({ error: 'Precio no configurado' }, { status: 400 })
    }
    console.error('drafts PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── DELETE /api/pos/drafts/[id] — discard a draft ── */

export async function DELETE(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const draftId = parseInt(params.id, 10)
  if (isNaN(draftId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    // FIX 1: ownership check + delete are atomic in a single interactive transaction
    // The delete includes status:'draft' so a concurrent promotion to 'paid' causes
    // Prisma P2025 rather than silently destroying a completed sale.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: draftId, business_id: session.businessId, cashier_id: session.userId, status: 'draft' },
      })
      if (!existing) throw new Error('NOT_FOUND')
      await tx.saleItem.deleteMany({ where: { sale_id: draftId } })
      await tx.sale.delete({ where: { id: draftId, status: 'draft' } })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    }
    console.error('drafts DELETE:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
