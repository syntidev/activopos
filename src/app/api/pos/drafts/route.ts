import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { draftItemSchema } from '@/lib/draft-schema'

const MAX_DRAFTS = 5

const createDraftSchema = z.object({
  items: z.array(draftItemSchema).min(0).default([]),
  notes: z.string().max(500).optional(),
})

/* ── GET /api/pos/drafts — list cashier's active drafts ── */

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const drafts = await db.sale.findMany({
      where:   { cashier_id: session.userId, status: 'draft' }, // business_id inyectado por el tenant layer
      include: { items: true },
      orderBy: { created_at: 'desc' },
      take:    MAX_DRAFTS,
    })

    return NextResponse.json({ ok: true, drafts })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

/* ── POST /api/pos/drafts — create new empty draft ── */

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = createDraftSchema.parse(await req.json())

    // FIX 3: BCV rate fetched before transaction — avoids holding pool connection during network call
    const rate = await getBcvRate()

    const draft = await prisma.$transaction(async (tx) => {
      const count = await tx.sale.count({
        where: { business_id: session.businessId, cashier_id: session.userId, status: 'draft' },
      })
      if (count >= MAX_DRAFTS) {
        throw new Error('MAX_DRAFTS')
      }

      // Fetch prices from DB if items provided
      let saleItemsData: {
        product_id: number; product_name: string; sale_mode: string; unit_label: string
        quantity: number; price_per_unit_usd: number; subtotal_usd: number
        subtotal_bs: number; rate_used: number; discount_usd: number; variant_id?: number
      }[] = []

      if (body.items.length > 0) {
        const productIds = Array.from(new Set(body.items.map(i => i.product_id)))
        const products   = await tx.product.findMany({
          where:  { id: { in: productIds }, business_id: session.businessId, active: true },
          select: { id: true, name: true, sale_mode: true, unit_label: true, price_per_unit_usd: true, price_per_kg_usd: true },
        })
        if (products.length !== productIds.length) throw new Error('PRODUCT_NOT_FOUND')
        const productMap = new Map(products.map(p => [p.id, p]))

        saleItemsData = body.items.map(item => {
          const p        = productMap.get(item.product_id)!
          const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
          if (priceUsd <= 0) throw new Error('PRICE_MISSING')
          const subtotal_usd = Math.max(0, item.quantity * priceUsd - item.discount_usd)
          return {
            product_id:         item.product_id,
            product_name:       p.name,
            sale_mode:          p.sale_mode,
            unit_label:         p.unit_label,
            quantity:           item.quantity,
            price_per_unit_usd: priceUsd,
            subtotal_usd:       Math.round(subtotal_usd * 100) / 100,
            subtotal_bs:        Math.round(subtotal_usd * rate * 100) / 100,
            rate_used:          rate,
            discount_usd:       item.discount_usd,
            ...(item.variant_id != null && { variant_id: item.variant_id }),
          }
        })
      }

      const total_usd = saleItemsData.reduce((acc, i) => acc + i.subtotal_usd, 0)
      const total_bs  = Math.round(total_usd * rate * 100) / 100

      // Create with placeholder ticket, then update to DRF-{id}
      const s = await tx.sale.create({
        data: {
          business_id:   session.businessId,
          cashier_id:    session.userId,
          ticket_number: 'DRAFT',
          status:        'draft',
          origin:        'pos',
          total_usd,
          total_bs,
          rate_used:     rate,
          notes:         body.notes ?? null,
          ...(saleItemsData.length > 0 && {
            items: { create: saleItemsData },
          }),
        },
        include: { items: true },
      })

      return tx.sale.update({
        where:   { id: s.id },
        data:    { ticket_number: `DRF-${String(s.id).padStart(5, '0')}` },
        include: { items: true },
      })
    })

    return NextResponse.json({ ok: true, draft }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if (err instanceof Error) {
      // FIX 8: 409 → 400 — quota rejection is a client error, not a conflict
      if (err.message === 'MAX_DRAFTS')        return NextResponse.json({ error: `Máximo ${MAX_DRAFTS} tickets abiertos por cajero` }, { status: 400 })
      if (err.message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
      if (err.message === 'PRICE_MISSING')     return NextResponse.json({ error: 'Precio no configurado' }, { status: 400 })
    }
    console.error('drafts POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
