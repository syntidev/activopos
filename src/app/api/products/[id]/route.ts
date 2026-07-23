import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getActiveRate } from '@/lib/bcv'
import { revalidateCatalogCache } from '@/lib/catalog'
import { z } from 'zod'

const patchSchema = z.object({
  name:               z.string().min(1).max(120).optional(),
  category_id:        z.number().int().nullable().optional(),
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
  subcategory:        z.string().max(60).nullable().optional(),
  is_featured:        z.boolean().optional(),
  active:             z.boolean().optional(),
  is_active:          z.boolean().optional(),
  sort_order:             z.number().int().optional(),
  availability:           z.enum(['in_stock', 'low_stock', 'out_of_stock', 'discontinued']).optional(),
  catalog_visibility:     z.enum(['visible', 'hidden', 'on_request']).optional(),
  stock_alert_threshold:  z.number().int().min(0).optional(),
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
    const { margin, is_active, ...data } = patchSchema.parse(body)
    if (is_active !== undefined) data.active = is_active

    const existing = await db.product.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

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
    if (images !== undefined) {
      patchData.images = images ? JSON.stringify(images) : null
    }

    const product = await db.product.update({
      where: { id }, // business_id inyectado por el tenant layer
      data: patchData,
      include: { category: true },
    })

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

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [existing, salesCount] = await Promise.all([
      db.product.findFirst({ where: { id } }), // business_id inyectado por el tenant layer
      // SaleItem no tiene business_id; el producto se valida por ownership abajo
      db.saleItem.count({ where: { product_id: id } }),
    ])
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    if (salesCount > 0) {
      return NextResponse.json(
        {
          error: 'Este producto tiene historial de ventas. Te recomendamos desactivarlo en lugar de eliminarlo.',
          sales_count: salesCount,
        },
        { status: 409 }
      )
    }

    await db.product.delete({ where: { id } }) // business_id inyectado por el tenant layer
    await revalidateCatalogCache(session.businessId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
