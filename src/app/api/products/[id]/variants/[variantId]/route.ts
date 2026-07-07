import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  valor:        z.string().min(1).max(50).optional(),
  sku:          z.string().max(50).nullable().optional(),
  precio_extra: z.number().min(0).optional(),
  stock:        z.number().int().min(0).optional(),
  color_hex:    z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  is_active:    z.boolean().optional(),
  sort_order:   z.number().int().optional(),
  price_usd:    z.number().min(0).nullable().optional(),
  cost_usd:     z.number().min(0).nullable().optional(),
})

type RouteContext = { params: { id: string; variantId: string } }

const parseId = (raw: string) => { const n = parseInt(raw); return isNaN(n) ? null : n }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const productId = parseId(params.id)
    const variantId = parseId(params.variantId)
    if (!productId || !variantId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Guard de propiedad: business_id inyectado por el tenant layer
    const product = await db.product.findFirst({ where: { id: productId }, select: { id: true } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    // ProductVariant no tiene business_id — aislado vía product_id del producto ya validado
    const existing = await db.productVariant.findFirst({
      where: { id: variantId, product_id: productId },
    })
    if (!existing) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })

    const body     = patchSchema.parse(await req.json())
    const oldStock = existing.stock

    // $transaction en prisma base: update de la variante + InventoryEntry de ajuste
    // atómicos (business_id manual — la extension tenant no propaga al tx).
    const variant = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.update({
        where: { id: variantId },
        data:  body,
      })
      // Sincroniza net_inventory con el cambio manual de stock de la variante.
      if (body.stock !== undefined) {
        const delta = body.stock - oldStock
        if (delta !== 0) {
          await tx.inventoryEntry.create({
            data: {
              business_id: session.businessId,
              product_id:  productId,
              quantity:    delta > 0 ? delta : 0,
              waste:       delta < 0 ? Math.abs(delta) : 0,
              entry_type:  'adjustment',
              notes:       `Ajuste manual variante ${variantId}`,
              created_by:  session.userId,
            },
          })
        }
      }
      return v
    })

    return NextResponse.json({ ok: true, variant: { ...variant, precio_extra: Number(variant.precio_extra) } })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Variant patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const productId = parseId(params.id)
    const variantId = parseId(params.variantId)
    if (!productId || !variantId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const product = await db.product.findFirst({ where: { id: productId }, select: { id: true } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const existing = await db.productVariant.findFirst({
      where: { id: variantId, product_id: productId },
    })
    if (!existing) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })

    await db.productVariant.update({ where: { id: variantId }, data: { is_active: false } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
