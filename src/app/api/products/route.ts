import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getBcvRate } from '@/lib/bcv'
import { z } from 'zod'

const productSchema = z.object({
  name:               z.string().min(1).max(120),
  category_id:        z.number().int().nullable().optional(),
  barcode:            z.string().max(50).nullable().optional(),
  sku:                z.string().max(50).nullable().optional(),
  description:        z.string().nullable().optional(),
  sale_mode:          z.enum(['weight', 'unit', 'service', 'length', 'volume', 'package']).default('unit'),
  product_type:       z.string().default('physical'),
  base_unit_label:    z.string().max(20).default('und'),
  cost_per_unit_usd:  z.number().min(0).nullable().optional(),
  margin:             z.number().min(0).max(99.99).optional(),
  price_per_unit_usd: z.number().min(0).nullable().optional(),
  price_per_kg_usd:   z.number().min(0).nullable().optional(),
  min_stock:          z.number().min(0).default(0),
  images:             z.array(z.string().url()).nullable().optional(),
  is_available:       z.boolean().default(true),
  has_variants:       z.boolean().default(false),
  show_in_catalog:    z.boolean().default(false),
  catalog_visibility: z.enum(['visible', 'hidden', 'on_request']).default('hidden'),
  availability:       z.enum(['in_stock', 'low_stock', 'out_of_stock', 'discontinued']).default('in_stock'),
  is_favorite:        z.boolean().default(false),
  badge:              z.enum(['none', 'popular', 'nuevo', 'promo', 'recomendado']).default('none'),
  subcategory:        z.string().max(60).nullable().optional(),
  is_featured:        z.boolean().default(false),
  sort_order:         z.number().int().default(0),
})

const calcPrice = (
  cost: number | null | undefined,
  margin: number | undefined,
  override: number | null | undefined
): number | null => {
  if (override != null) return override
  if (cost != null && margin != null) return cost / (1 - margin / 100)
  return null
}

function parseImages(raw: string | null): string[] | null {
  if (!raw) return null
  try { return JSON.parse(raw) as string[] } catch { return null }
}

function computeAvailability(
  dbAvailability: string,
  productType: string,
  netStock: number,
  minStock: number
): string {
  if (dbAvailability === 'discontinued') return 'discontinued'
  if (productType === 'service') return 'in_stock'
  if (netStock <= 0) return 'out_of_stock'
  if (netStock <= minStock) return 'low_stock'
  return 'in_stock'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sp              = req.nextUrl.searchParams
  const search          = sp.get('search') ?? ''
  const categoryId      = sp.get('category_id')
  const showInactive    = sp.get('active') === 'false'
  const lowStockOnly    = sp.get('low_stock') === 'true'
  const availableFilter = sp.get('available')
  const posFilter       = sp.get('pos') === 'true'

  const [products, stockAgg, rate, biz] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id: session.businessId,
        active:      showInactive ? false : true,
        ...(availableFilter === 'true'  ? { is_available: true  } : {}),
        ...(availableFilter === 'false' ? { is_available: false } : {}),
        ...(posFilter ? { available_in_pos: true } : {}),
        ...(search     ? { name: { contains: search } } : {}),
        ...(categoryId ? { category_id: parseInt(categoryId) } : {}),
      },
      include: {
        category: true,
        variants: {
          where:   { is_active: true },
          orderBy: [{ sort_order: 'asc' }, { valor: 'asc' }],
        },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventoryEntry.groupBy({
      by:    ['product_id'],
      where: { business_id: session.businessId },
      _sum:  { quantity: true, waste: true },
    }),
    getBcvRate(),
    prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { iva_enabled: true, iva_pct: true },
    }),
  ])

  const ivaEnabled = biz?.iva_enabled ?? false
  const ivaPct     = Number(biz?.iva_pct ?? 16)

  const stockMap = new Map(
    stockAgg.map(s => [
      s.product_id,
      {
        quantity: Number(s._sum.quantity ?? 0),
        waste:    Number(s._sum.waste    ?? 0),
        net_qty:  Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0),
      },
    ])
  )

  const result = products
    .map(p => {
      const stock    = stockMap.get(p.id) ?? { quantity: 0, waste: 0, net_qty: 0 }
      const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0) || null
      const costUsd  = p.cost_per_unit_usd ? Number(p.cost_per_unit_usd) : null
      return {
        ...p,
        images:             parseImages(p.images),
        variants:           p.variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
        price_per_unit_usd: p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null,
        price_per_kg_usd:   p.price_per_kg_usd   ? Number(p.price_per_kg_usd)   : null,
        cost_per_unit_usd:  costUsd,
        min_stock:          Number(p.min_stock),
        stock,
        price_bs:           priceUsd ? priceUsd * rate : null,
        profit_usd:         priceUsd && costUsd ? priceUsd - costUsd : null,
        price_with_iva_usd: ivaEnabled && priceUsd
          ? Math.round(priceUsd * (1 + ivaPct / 100) * 10000) / 10000
          : null,
        iva_pct:            ivaEnabled ? ivaPct : null,
        is_low_stock:       stock.net_qty < Number(p.min_stock),
        availability:       computeAvailability(p.availability, p.product_type, stock.net_qty, Number(p.min_stock)),
        catalog_visibility: p.catalog_visibility,
      }
    })
    .filter(p => !lowStockOnly || p.is_low_stock)

  return NextResponse.json({
    ok:          true,
    products:    result,
    rate,
    iva_enabled: ivaEnabled,
    iva_pct:     ivaEnabled ? ivaPct : null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  try {
    const body                = await req.json()
    const { margin, ...data } = productSchema.parse(body)

    // service type always inherits service sale_mode and is always in_stock
    if (data.product_type === 'service') {
      data.sale_mode    = 'service'
      data.availability = 'in_stock'
    }

    const product = await prisma.product.create({
      data: {
        business_id:        session.businessId,
        name:               data.name,
        category_id:        data.category_id        ?? null,
        barcode:            data.barcode            ?? null,
        sku:                data.sku                ?? null,
        description:        data.description        ?? null,
        sale_mode:          data.sale_mode,
        product_type:       data.product_type,
        base_unit_label:    data.base_unit_label,
        cost_per_unit_usd:  data.cost_per_unit_usd  ?? null,
        price_per_unit_usd: calcPrice(data.cost_per_unit_usd, margin, data.price_per_unit_usd),
        price_per_kg_usd:   data.price_per_kg_usd   ?? null,
        min_stock:          data.min_stock,
        images:             data.images ? JSON.stringify(data.images) : null,
        is_available:       data.is_available,
        has_variants:       data.has_variants,
        show_in_catalog:    data.show_in_catalog,
        catalog_visibility: data.catalog_visibility,
        availability:       data.availability,
        is_favorite:        data.is_favorite,
        badge:              data.badge,
        subcategory:        data.subcategory        ?? null,
        is_featured:        data.is_featured,
        sort_order:         data.sort_order,
      },
      include: {
        category: true,
        variants: { where: { is_active: true }, orderBy: [{ sort_order: 'asc' }] },
      },
    })

    return NextResponse.json({
      ok:      true,
      product: {
        ...product,
        images:   parseImages(product.images),
        variants: product.variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Product create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
