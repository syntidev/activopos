import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getActiveRate } from '@/lib/bcv'
import { revalidateCatalogCache } from '@/lib/catalog'
import { prisma } from '@/lib/prisma'
import { createStockAdjustment, getNetStock } from '@/lib/stock-adjust'
import { z } from 'zod'
import { cleanSubcategory } from '@/lib/subcategory'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/safe-log'

const patchSchema = z.object({
  name:               z.string().min(1).max(120).optional(),
  category_id:        z.number().int().nullable().optional(),
  // Marca (tabla brands) del negocio; null la quita. Se valida que sea suya antes de guardar.
  brand_id:           z.number().int().positive().nullable().optional(),
  barcode:            z.string().max(50).nullable().optional(),
  sku:                z.string().max(50).nullable().optional(),
  description:        z.string().nullable().optional(),
  sale_mode:          z.enum(['weight', 'unit', 'service', 'length', 'volume', 'package']).optional(),
  product_type:       z.enum(['simple', 'combo', 'fabricable']).optional(),
  unit_type:          z.enum(['unit', 'weight', 'volume', 'length']).optional(),
  unit_label:         z.string().max(20).optional(),
  unit_step:          z.number().positive().optional(),
  base_unit_label:    z.string().max(20).optional(),
  cost_per_unit_usd:  z.number().min(0).nullable().optional(),
  margin:             z.number().min(0).max(99.99).optional(),
  price_per_unit_usd: z.number().min(0).nullable().optional(),
  price_per_kg_usd:   z.number().min(0).nullable().optional(),
  wholesale_price_usd:        z.number().min(0).nullable().optional(),
  wholesale_price_per_kg_usd: z.number().min(0).nullable().optional(),
  location:                   z.string().max(120).nullable().optional(),
  notes:                      z.string().nullable().optional(),
  min_stock:          z.number().min(0).optional(),
  is_favorite:        z.boolean().optional(),
  is_available:       z.boolean().optional(),
  show_in_catalog:    z.boolean().optional(),
  has_variants:       z.boolean().optional(),
  images:             z.array(z.string()).nullable().optional(),
  badge:              z.enum(['none', 'popular', 'nuevo', 'promo', 'recomendado']).nullable().optional(),
  subcategory:        z.string().max(60).nullable().optional()
    .transform(v => (v == null ? v : cleanSubcategory(v) || null)),
  is_featured:        z.boolean().optional(),
  is_fixed_price:     z.boolean().optional(),
  cost_unknown:       z.boolean().optional(),
  active:             z.boolean().optional(),
  is_active:          z.boolean().optional(),
  sort_order:             z.number().int().optional(),
  availability:           z.enum(['in_stock', 'low_stock', 'out_of_stock', 'discontinued']).optional(),
  catalog_visibility:     z.enum(['visible', 'hidden', 'on_request']).optional(),
  stock_alert_threshold:  z.number().int().min(0).optional(),
  financing_eligible:     z.boolean().optional(),
  financing_excluded:     z.boolean().optional(),
  // Existencia objetivo: el servidor calcula delta y lo registra como ajuste (nunca escribe stock directo).
  stock_quantity:         z.number().min(0).optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    // El detalle expone cost_per_unit_usd y profit_usd. Es dato financiero: solo
    // admin/super_admin. El POS del cashier usa /api/products/search (redactado),
    // nunca este detalle. Sin este guard, un cashier lo saca por API directa.
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [product, stockAgg, rate] = await Promise.all([
      db.product.findFirst({
        where: { id }, // business_id inyectado por el tenant layer
        include: { category: true },
      }),
      db.inventoryEntry.aggregate({
        where: { product_id: id }, // business_id inyectado por el tenant layer
        _sum: { quantity: true, waste: true },
      }),
      getActiveRate(session.businessId).then(r => r.rate),
    ])

    if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const qty = Number(stockAgg._sum.quantity ?? 0)
    const waste = Number(stockAgg._sum.waste ?? 0)
    const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0) || null
    const costUsd = product.cost_per_unit_usd ? Number(product.cost_per_unit_usd) : null

    return NextResponse.json({
      ok: true,
      product: {
        ...product,
        price_per_unit_usd: product.price_per_unit_usd ? Number(product.price_per_unit_usd) : null,
        price_per_kg_usd: product.price_per_kg_usd ? Number(product.price_per_kg_usd) : null,
        wholesale_price_usd: product.wholesale_price_usd != null ? Number(product.wholesale_price_usd) : null,
        wholesale_price_per_kg_usd: product.wholesale_price_per_kg_usd != null ? Number(product.wholesale_price_per_kg_usd) : null,
        cost_per_unit_usd: costUsd,
        min_stock: Number(product.min_stock),
        stock_alert_threshold: product.stock_alert_threshold,
        stock: { quantity: qty, waste, net_qty: qty - waste },
        price_bs: priceUsd ? priceUsd * rate : null,
        profit_usd: priceUsd && costUsd ? priceUsd - costUsd : null,
        is_low_stock: (qty - waste) < Number(product.min_stock),
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json()
    const { margin, is_active, stock_quantity, ...data } = patchSchema.parse(body)
    if (is_active !== undefined) data.active = is_active

    const existing = await db.product.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Marca: el id llega del body, así que debe pertenecer a este negocio.
    if (data.brand_id) {
      const brand = await db.brand.findFirst({ where: { id: data.brand_id }, select: { id: true } }) // business_id inyectado
      if (!brand) return NextResponse.json({ error: 'Marca no encontrada', field: 'brand_id' }, { status: 422 })
    }

    // service sale_mode always available in_stock
    if (data.sale_mode === 'service') {
      data.availability = 'in_stock'
    }

    // Recalculate price if margin provided and no explicit price override
    const { images, ...rest } = data
    const patchData: Record<string, unknown> = { ...rest }
    if (margin !== undefined && rest.price_per_unit_usd === undefined) {
      const cost = rest.cost_per_unit_usd ?? Number(existing.cost_per_unit_usd ?? 0)
      patchData.price_per_unit_usd = cost / (1 - margin / 100)
    }
    if (rest.cost_unknown === true) {
      patchData.cost_per_unit_usd = null
    }
    if (images !== undefined) {
      patchData.images = images ? JSON.stringify(images) : null
    }

    const product = await db.product.update({
      where: { id }, // business_id inyectado por el tenant layer
      data: patchData,
      include: { category: true },
    })

    // Con variantes el stock vive en cada variante (PATCH /variants/[variantId]).
    if (stock_quantity !== undefined && !product.has_variants) {
      const current = await getNetStock(prisma, session.businessId, id)
      const delta   = stock_quantity - current
      if (delta !== 0) {
        await createStockAdjustment(prisma, {
          businessId: session.businessId,
          productId:  id,
          userId:     session.userId,
          quantity:   delta,
          notes:      'Ajuste desde edición de producto',
        })
      }
    }

    await revalidateCatalogCache(session.businessId)

    return NextResponse.json({ ok: true, product })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Product patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * Historial del producto = todo lo que borrarlo dejaría sin referencia o rompería. Ninguna de estas tablas
 * tiene business_id: la propiedad del producto ya se validó antes (db.product.findFirst, capa de tenant).
 * El stock inicial / ajustes manuales (inventory_entries 'adjustment') NO cuentan: se van con el producto.
 */
async function productHistory(id: number): Promise<{ total: number; detail: string[] }> {
  const [sales, orders, quotes, returns, purchases, reservas, kits, movements] = await Promise.all([
    prisma.saleItem.count({ where: { product_id: id } }),
    prisma.orderItem.count({ where: { product_id: id } }),
    prisma.quotationItem.count({ where: { product_id: id } }),
    prisma.returnItem.count({ where: { product_id: id } }),
    prisma.purchaseItem.count({ where: { product_id: id } }),
    prisma.reserva.count({ where: { kit_id: id } }),
    prisma.productComponent.count({ where: { OR: [{ parent_id: id }, { component_id: id }] } }),
    prisma.inventoryEntry.count({ where: { product_id: id, entry_type: { not: 'adjustment' } } }),
  ])
  const parts: Array<[number, string]> = [
    [sales, 'ventas'], [orders, 'pedidos'], [quotes, 'cotizaciones'], [returns, 'devoluciones'],
    [purchases, 'compras'], [reservas, 'reservas'], [kits, 'kits'], [movements, 'movimientos de inventario'],
  ]
  return { total: parts.reduce((s, [n]) => s + n, 0), detail: parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`) }
}

const deleteError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, error: message, message }, { status })

/**
 * DELETE /api/products/[id]
 *  - sin historial → se borra (con su stock inicial, variantes y vínculos de colección): 200 { action: 'deleted' }
 *  - con historial → NO se borra, se DESACTIVA (active=false: sale del POS y del catálogo): 200 { action: 'deactivated' }
 * Toda respuesta trae `code` y `message` (español, listo para mostrar tal cual); los errores además `error`.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return deleteError(403, 'FORBIDDEN', 'No tienes permiso para eliminar productos.')

    const id = parseId(params.id)
    if (!id) return deleteError(400, 'INVALID_ID', 'El identificador del producto no es válido.')

    const existing = await db.product.findFirst({ where: { id }, select: { id: true, name: true } }) // business_id inyectado
    if (!existing) return deleteError(404, 'NOT_FOUND', 'No encontramos ese producto. Puede que ya se haya eliminado.')

    const history = await productHistory(id)
    if (history.total > 0) {
      await db.product.update({ where: { id }, data: { active: false } }) // business_id inyectado
      await revalidateCatalogCache(session.businessId)
      return NextResponse.json({
        ok: true,
        action: 'deactivated',
        code: 'HAS_HISTORY',
        message: `"${existing.name}" ya tiene historial (${history.detail.join(', ')}), por eso no se borró: se desactivó y ya no aparece en el POS ni en el catálogo.`,
        history: history.detail,
      })
    }

    await prisma.$transaction([
      prisma.inventoryEntry.deleteMany({ where: { product_id: id, business_id: session.businessId } }),
      prisma.productVariant.deleteMany({ where: { product_id: id } }),
      prisma.productCollection.deleteMany({ where: { product_id: id } }),
      prisma.product.deleteMany({ where: { id, business_id: session.businessId } }),
    ])
    await revalidateCatalogCache(session.businessId)
    return NextResponse.json({ ok: true, action: 'deleted', code: 'DELETED', message: `"${existing.name}" se eliminó.` })
  } catch (e) {
    if (e instanceof TenantError) return deleteError(e.status, e.code, e.status === 401 ? 'Tu sesión venció. Entra de nuevo.' : 'No tienes permiso para eliminar productos.')
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      // Una FK que productHistory no cubre: nunca un 500 mudo.
      logError('Product delete blocked by FK', e)
      return deleteError(409, 'IN_USE', 'Este producto está en uso en otros registros y no se puede eliminar. Desactívalo para ocultarlo.')
    }
    logError('Product delete error', e)
    return deleteError(500, 'SERVER_ERROR', 'No se pudo eliminar el producto. Intenta de nuevo en unos segundos.')
  }
}
