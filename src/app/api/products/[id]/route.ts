import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getBcvRate } from '@/lib/bcv'
import { z } from 'zod'

const patchSchema = z.object({
  name:               z.string().min(1).max(120).optional(),
  category_id:        z.number().int().nullable().optional(),
  barcode:            z.string().max(50).nullable().optional(),
  sku:                z.string().max(50).nullable().optional(),
  description:        z.string().nullable().optional(),
  sale_mode:          z.enum(['weight', 'unit', 'service']).optional(),
  product_type:       z.string().optional(),
  base_unit_label:    z.string().max(10).optional(),
  cost_per_unit_usd:  z.number().min(0).nullable().optional(),
  margin:             z.number().min(0).max(99.99).optional(),
  price_per_unit_usd: z.number().min(0).nullable().optional(),
  price_per_kg_usd:   z.number().min(0).nullable().optional(),
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
  sort_order:         z.number().int().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const [product, stockAgg, rate] = await Promise.all([
    prisma.product.findFirst({
      where: { id, business_id: session.businessId },
      include: { category: true },
    }),
    prisma.inventoryEntry.aggregate({
      where: { product_id: id, business_id: session.businessId },
      _sum: { quantity: true, waste: true },
    }),
    getBcvRate(),
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
      cost_per_unit_usd: costUsd,
      min_stock: Number(product.min_stock),
      stock: { quantity: qty, waste, net_qty: qty - waste },
      price_bs: priceUsd ? priceUsd * rate : null,
      profit_usd: priceUsd && costUsd ? priceUsd - costUsd : null,
      is_low_stock: (qty - waste) < Number(product.min_stock),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const { margin, ...data } = patchSchema.parse(body)

    const existing = await prisma.product.findFirst({
      where: { id, business_id: session.businessId },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

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

    const product = await prisma.product.update({
      where: { id },
      data: patchData,
      include: { category: true },
    })

    return NextResponse.json({ ok: true, product })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Product patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.product.findFirst({
    where: { id, business_id: session.businessId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.product.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
