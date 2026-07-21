import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { getActiveRate } from '@/lib/bcv'
import { z } from 'zod'

const productSchema = z.object({
  name:               z.string().min(1).max(120),
  category_id:        z.number().int().nullable().optional(),
  barcode:            z.string().max(50).nullable().optional(),
  sku:                z.string().max(50).nullable().optional(),
  description:        z.string().nullable().optional(),
  sale_mode:          z.enum(['weight', 'unit', 'service', 'length', 'volume', 'package']).default('unit'),
  product_type:       z.enum(['simple', 'combo', 'fabricable']).default('simple'),
  unit_type:          z.enum(['unit', 'weight', 'volume', 'length']).default('unit'),
  unit_label:         z.string().max(20).default('und'),
  unit_step:          z.number().positive().default(1),
  base_unit_label:    z.string().max(20).default('und'),
  cost_per_unit_usd:  z.number().min(0).nullable().optional(),
  margin:             z.number().min(0).max(99.99).optional(),
  price_per_unit_usd: z.number().min(0).nullable().optional(),
  price_per_kg_usd:   z.number().min(0).nullable().optional(),
  wholesale_price_usd:        z.number().min(0).nullable().optional(),
  wholesale_price_per_kg_usd: z.number().min(0).nullable().optional(),
  location:                   z.string().max(120).nullable().optional(),
  notes:                      z.string().nullable().optional(),
  min_stock:          z.number().min(0).default(0),
  stock_quantity:     z.number().int().min(0).default(0),
  images:             z.array(z.string()).nullable().optional(),
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
  variants:           z.array(z.object({
    tipo:         z.enum(['talla', 'color', 'personalizado']),
    valor:        z.string().min(1).max(50),
    precio_extra: z.number().min(0).default(0),
    stock:        z.number().int().min(0).default(0),
  })).optional(),
  // Variantes combinadas (multi-dimensión). variant_dimensions define los ejes
  // (talla, color…); variant_combinations trae el producto cartesiano ya resuelto
  // por el cliente, con stock/precio propio por combinación.
  variant_dimensions: z.array(z.object({
    tipo:    z.string().min(1).max(30),
    valores: z.array(z.string().min(1).max(50)).min(1),
  })).min(1).optional(),
  variant_combinations: z.array(z.object({
    combination_key: z.string().min(1).max(255),
    stock:           z.number().int().min(0).default(0),
    precio_extra:    z.number().min(0).default(0),
  })).min(1).optional(),
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
  saleMode: string,
  netStock: number,
  minStock: number
): string {
  if (dbAvailability === 'discontinued') return 'discontinued'
  if (saleMode === 'service') return 'in_stock'
  if (netStock <= 0) return 'out_of_stock'
  if (netStock <= minStock) return 'low_stock'
  return 'in_stock'
}

export async function GET(req: NextRequest) {
  try {
    // Tenant layer: db ya filtra por business_id en cada query automáticamente.
    const { session, db } = await getAuthenticatedTenant()

    const sp              = req.nextUrl.searchParams
    const search          = sp.get('search') ?? ''
    const categoryId      = sp.get('category_id')
    const showInactive    = sp.get('active') === 'false'
    const lowStockOnly    = sp.get('low_stock') === 'true'
    const availableFilter = sp.get('available')
    const posFilter       = sp.get('pos') === 'true'

    const [products, stockAgg, rate, biz] = await Promise.all([
      db.product.findMany({
        where: {
          // business_id inyectado por el tenant layer
          active: showInactive ? false : true,
          ...(availableFilter === 'true'  ? { is_available: true  } : {}),
          ...(availableFilter === 'false' ? { is_available: false } : {}),
          ...(posFilter ? { available_in_pos: true } : {}),
          ...(search
            ? {
                OR: [
                  { name:    { contains: search } },
                  { sku:     { contains: search } },
                  { barcode: { contains: search } },
                ],
              }
            : {}),
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
      db.inventoryEntry.groupBy({
        by:   ['product_id'],
        // business_id inyectado por el tenant layer
        _sum: { quantity: true, waste: true },
      }),
      getActiveRate(session.businessId).then(r => r.rate),
      // Business es la raíz del tenant (no tiene business_id) → no se filtra.
      db.business.findUnique({
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

    // Cajero: nunca ve costo ni utilidad — el GET lo usa tanto el buscador del
    // POS (cashier lo necesita para vender) como la página admin de Productos,
    // así que se redacta el campo en vez de bloquear el endpoint entero.
    const isCashier = session.role === 'cashier'

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
          wholesale_price_usd:        p.wholesale_price_usd        != null ? Number(p.wholesale_price_usd)        : null,
          wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd != null ? Number(p.wholesale_price_per_kg_usd) : null,
          cost_per_unit_usd:  isCashier ? null : costUsd,
          min_stock:          Number(p.min_stock),
          stock,
          price_bs:           priceUsd ? priceUsd * rate : null,
          profit_usd:         isCashier ? null : (priceUsd && costUsd ? priceUsd - costUsd : null),
          price_with_iva_usd: ivaEnabled && priceUsd
            ? Math.round(priceUsd * (1 + ivaPct / 100) * 10000) / 10000
            : null,
          iva_pct:            ivaEnabled ? ivaPct : null,
          is_low_stock:       stock.net_qty < Number(p.min_stock),
          availability:       computeAvailability(p.availability, p.sale_mode, stock.net_qty, Number(p.min_stock)),
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
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body                = await req.json()
    const { margin, ...data } = productSchema.parse(body)

    // service sale_mode always available in_stock
    if (data.sale_mode === 'service') {
      data.availability = 'in_stock'
    }

    const planCheck = await checkPlanLimit('create_product')
    if (!planCheck.allowed) return planDenied(planCheck.reason)

    // Filas de variante a crear. variant_combinations (multi-dimensión) tiene
    // prioridad: tipo = tipos combinados ("talla+color"), valor = combination_key
    // ("S-Azul"). Si no, cae al array plano `variants` (una sola dimensión,
    // combination_key null).
    const combinedTipo = data.variant_dimensions?.map(d => d.tipo).join('+') ?? ''
    const variantRows: {
      tipo: string; valor: string; precio_extra: number; stock: number; combination_key: string | null
    }[] =
      data.variant_combinations?.length
        ? data.variant_combinations.map(c => ({
            tipo:            combinedTipo,
            valor:           c.combination_key,
            precio_extra:    c.precio_extra,
            stock:           c.stock,
            combination_key: c.combination_key,
          }))
        : (data.variants?.map(v => ({
            tipo:            v.tipo,
            valor:           v.valor,
            precio_extra:    v.precio_extra,
            stock:           v.stock,
            combination_key: null,
          })) ?? [])

    const product = await db.product.create({
      data: {
        business_id:        session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name:               data.name,
        category_id:        data.category_id        ?? null,
        barcode:            data.barcode            ?? null,
        sku:                data.sku                ?? null,
        description:        data.description        ?? null,
        sale_mode:          data.sale_mode,
        product_type:       data.product_type,
        unit_type:          data.unit_type,
        unit_label:         data.unit_label,
        unit_step:          data.unit_step,
        base_unit_label:    data.base_unit_label,
        cost_per_unit_usd:  data.cost_per_unit_usd  ?? null,
        price_per_unit_usd: calcPrice(data.cost_per_unit_usd, margin, data.price_per_unit_usd),
        price_per_kg_usd:   data.price_per_kg_usd   ?? null,
        wholesale_price_usd:        data.wholesale_price_usd        ?? null,
        wholesale_price_per_kg_usd: data.wholesale_price_per_kg_usd ?? null,
        location:                   data.location                  ?? null,
        notes:                      data.notes                     ?? null,
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
        variants: variantRows.length
          ? { create: variantRows.map(v => ({
              tipo:            v.tipo,
              valor:           v.valor,
              precio_extra:    v.precio_extra,
              stock:           v.stock,
              combination_key: v.combination_key,
            })) }
          : undefined,
      },
      include: {
        category: true,
        variants: { where: { is_active: true }, orderBy: [{ sort_order: 'asc' }] },
      },
    })

    // Coherencia con el sistema de stock: cada variante con stock inicial > 0
    // genera su InventoryEntry de arranque (mismo patrón que el alta sin variantes).
    const initialStockEntries = product.variants
      .filter(v => v.stock > 0)
      .map(v => ({
        business_id: session.businessId,
        product_id:  product.id,
        quantity:    v.stock,
        waste:       0,
        entry_type:  'adjustment',
        notes:       `Stock inicial — variante ${v.valor}`,
        created_by:  session.userId,
      }))
    if (initialStockEntries.length > 0) {
      await db.inventoryEntry.createMany({ data: initialStockEntries })
    }

    // Producto sin variantes: stock inicial viene de stock_quantity, no de variantRows.
    if (variantRows.length === 0 && data.stock_quantity > 0) {
      await db.inventoryEntry.create({
        data: {
          business_id: session.businessId,
          product_id:  product.id,
          quantity:    data.stock_quantity,
          waste:       0,
          entry_type:  'adjustment',
          notes:       'Stock inicial',
          created_by:  session.userId,
        },
      })
    }

    return NextResponse.json({
      ok:      true,
      product: {
        ...product,
        images:   parseImages(product.images),
        variants: product.variants.map(v => ({ ...v, precio_extra: Number(v.precio_extra) })),
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Product create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
