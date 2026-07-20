import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'

type Context = { params: { id: string } }

// Mismo tope que /api/pos/drafts — el POS no muestra más de 5 tickets abiertos
// por cajero. Duplicado a propósito: la constante de allá no está exportada y
// exportarla implicaría tocar ese archivo.
const MAX_DRAFTS = 5

/* ── POST /api/quotations/[id]/convert — Quotation(accepted) → draft del POS ──
 *
 * NO crea la venta ni descuenta stock: deja un ticket abierto en el POS con los
 * ítems ya cargados, para que el cajero cobre desde ahí. La cotización sigue en
 * 'accepted' — pasa a 'converted' recién cuando el POS confirma el pago.
 *
 * El draft se escribe acá y no vía POST /api/pos/drafts porque ese endpoint
 * re-deriva el precio del producto (drafts/route.ts:80) e ignora el precio
 * cotizado. Cotizar a $8 y cobrar $10 sería peor que duplicar 20 líneas.
 */

export async function POST(_req: NextRequest, { params }: Context) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let session: SessionPayload
  let db: TenantPrisma
  try {
    const t = await getAuthenticatedTenant()
    session = t.session
    db = t.db
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  // Validación (fuera del $transaction) → tenant layer
  const quotation = await db.quotation.findFirst({
    where:   { id }, // business_id inyectado por el tenant layer
    include: { items: true },
  })

  if (!quotation) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })

  if (quotation.status !== 'accepted') {
    return NextResponse.json(
      { error: 'Solo se puede convertir una cotización aceptada' },
      { status: 409 }
    )
  }

  if (quotation.items.length === 0) {
    return NextResponse.json({ error: 'La cotización no tiene ítems' }, { status: 422 })
  }

  // SaleItem.product_id es NOT NULL con FK a Product (schema.prisma:432,449):
  // un ítem sin producto no puede existir como línea de venta.
  const missingProduct = quotation.items.find(i => i.product_id == null)
  if (missingProduct) {
    return NextResponse.json(
      { error: `El ítem "${missingProduct.name}" no tiene producto asociado — todos los ítems deben tener producto para convertir a venta` },
      { status: 422 }
    )
  }

  const openDrafts = await db.sale.count({
    where: { cashier_id: session.userId, status: 'draft' }, // business_id inyectado
  })
  if (openDrafts >= MAX_DRAFTS) {
    return NextResponse.json(
      { error: `Tienes ${MAX_DRAFTS} tickets abiertos en el POS — cierra uno antes de convertir` },
      { status: 409 }
    )
  }

  const productIds = quotation.items.map(i => i.product_id as number)
  const { rate }   = await getActiveRate(session.businessId)
  const r2         = (x: number) => Math.round(x * 100) / 100

  try {
    // $transaction en prisma base: business_id manual adentro
    const draft = await prisma.$transaction(async tx => {
      const products = await tx.product.findMany({
        where:  { id: { in: productIds }, business_id: session.businessId },
        select: { id: true, sale_mode: true, base_unit_label: true, cost_per_unit_usd: true },
      })
      const productMap = new Map(products.map(p => [p.id, p]))
      if (productMap.size !== new Set(productIds).size) {
        throw new Error('PRODUCT_NOT_FOUND')
      }

      const items = quotation.items.map(i => {
        const p        = productMap.get(i.product_id as number)
        const qty      = Number(i.qty)
        const priceUsd = Number(i.price_usd)
        // discount_pct de la cotización → discount_usd, que es lo que entiende
        // SaleItem (schema.prisma:442). El POS ya sabe mostrarlo.
        const discountUsd  = r2(qty * priceUsd * (Number(i.discount_pct ?? 0) / 100))
        const subtotalUsd  = Math.max(0, r2(qty * priceUsd - discountUsd))
        return {
          product_id:         i.product_id as number,
          product_name:       i.name,
          sale_mode:          p?.sale_mode ?? 'unit',
          unit_label:         p?.base_unit_label ?? 'und',
          quantity:           qty,
          price_per_unit_usd: priceUsd,
          cost_per_unit_usd:  Number(p?.cost_per_unit_usd ?? 0),
          subtotal_usd:       subtotalUsd,
          subtotal_bs:        r2(subtotalUsd * rate),
          rate_used:          rate,
          discount_usd:       discountUsd,
        }
      })

      const total_usd = r2(items.reduce((acc, i) => acc + i.subtotal_usd, 0))

      // Mismo patrón que /api/pos/drafts: ticket placeholder y luego DRF-{id}.
      const s = await tx.sale.create({
        data: {
          business_id:   session.businessId,
          cashier_id:    session.userId,
          ticket_number: 'DRAFT',
          status:        'draft',
          origin:        'quote',
          total_usd,
          total_bs:      r2(total_usd * rate),
          rate_used:     rate,
          client_id:     quotation.client_id,
          sold_at:       null,
          notes:         `Cotización ${quotation.number}`,
          items:         { create: items },
        },
        select: { id: true },
      })

      return tx.sale.update({
        where:  { id: s.id },
        data:   { ticket_number: `DRF-${String(s.id).padStart(5, '0')}` },
        select: { id: true, ticket_number: true },
      })
    })

    // La cotización NO pasa a 'converted' acá — eso ocurre cuando el POS cobra.
    return NextResponse.json({ ok: true, draft_id: draft.id, ticket_number: draft.ticket_number })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Un producto de la cotización ya no existe en el catálogo' },
        { status: 422 }
      )
    }
    console.error('quotations convert POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
