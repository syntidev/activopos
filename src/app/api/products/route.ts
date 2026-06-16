import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getBcvRate } from '@/lib/bcv'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1).max(120),
  category_id: z.number().int().nullable().optional(),
  barcode: z.string().max(50).nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
  sale_mode: z.enum(['weight', 'unit', 'service']).default('unit'),
  product_type: z.string().default('physical'),
  base_unit_label: z.string().max(10).default('und'),
  cost_per_unit_usd: z.number().min(0).nullable().optional(),
  margin: z.number().min(0).max(99.99).optional(),
  price_per_unit_usd: z.number().min(0).nullable().optional(),
  price_per_kg_usd: z.number().min(0).nullable().optional(),
  min_stock: z.number().min(0).default(0),
  is_favorite: z.boolean().default(false),
  sort_order: z.number().int().default(0),
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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const search = sp.get('search') ?? ''
  const categoryId = sp.get('category_id')
  const showInactive = sp.get('active') === 'false'
  const lowStockOnly = sp.get('low_stock') === 'true'

  const [products, stockAgg, rate] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id: session.businessId,
        active: showInactive ? false : true,
        ...(search ? { name: { contains: search } } : {}),
        ...(categoryId ? { category_id: parseInt(categoryId) } : {}),
      },
      include: { category: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventoryEntry.groupBy({
      by: ['product_id'],
      where: { business_id: session.businessId },
      _sum: { quantity: true, waste: true },
    }),
    getBcvRate(),
  ])

  const stockMap = new Map(
    stockAgg.map(s => [
      s.product_id,
      {
        quantity: Number(s._sum.quantity ?? 0),
        waste: Number(s._sum.waste ?? 0),
        net_qty: Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0),
      },
    ])
  )

  const result = products
    .map(p => {
      const stock = stockMap.get(p.id) ?? { quantity: 0, waste: 0, net_qty: 0 }
      const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0) || null
      const costUsd = p.cost_per_unit_usd ? Number(p.cost_per_unit_usd) : null
      return {
        ...p,
        price_per_unit_usd: p.price_per_unit_usd ? Number(p.price_per_unit_usd) : null,
        price_per_kg_usd: p.price_per_kg_usd ? Number(p.price_per_kg_usd) : null,
        cost_per_unit_usd: costUsd,
        min_stock: Number(p.min_stock),
        stock,
        price_bs: priceUsd ? priceUsd * rate : null,
        profit_usd: priceUsd && costUsd ? priceUsd - costUsd : null,
        is_low_stock: stock.net_qty < Number(p.min_stock),
      }
    })
    .filter(p => !lowStockOnly || p.is_low_stock)

  return NextResponse.json({ ok: true, products: result, rate })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = await req.json()
    const { margin, ...data } = productSchema.parse(body)

    const product = await prisma.product.create({
      data: {
        business_id: session.businessId,
        name: data.name,
        category_id: data.category_id ?? null,
        barcode: data.barcode ?? null,
        sku: data.sku ?? null,
        description: data.description ?? null,
        sale_mode: data.sale_mode,
        product_type: data.product_type,
        base_unit_label: data.base_unit_label,
        cost_per_unit_usd: data.cost_per_unit_usd ?? null,
        price_per_unit_usd: calcPrice(data.cost_per_unit_usd, margin, data.price_per_unit_usd),
        price_per_kg_usd: data.price_per_kg_usd ?? null,
        min_stock: data.min_stock,
        is_favorite: data.is_favorite,
        sort_order: data.sort_order,
      },
      include: { category: true },
    })

    return NextResponse.json({ ok: true, product }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Product create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
