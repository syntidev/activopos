import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { draftItemSchema } from '@/lib/draft-schema'

const patchSchema = z.object({
  items: z.array(draftItemSchema).min(0),
  notes: z.string().max(500).optional(),
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

    // FIX 3: BCV rate fetched before transaction — avoids holding pool connection during network call
    const rate = await getBcvRate()

    const draft = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: draftId, business_id: session.businessId, cashier_id: session.userId, status: 'draft' },
      })
      if (!existing) throw new Error('NOT_FOUND')

      // Fetch prices from DB (anti-tampering)
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

    return NextResponse.json({ ok: true, draft })
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
