import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
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

async function guardProduct(productId: number, businessId: number) {
  return prisma.product.findFirst({
    where:  { id: productId, business_id: businessId },
    select: { id: true },
  })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  const productId = parseId(params.id)
  const variantId = parseId(params.variantId)
  if (!productId || !variantId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  if (!await guardProduct(productId, session.businessId)) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, product_id: productId },
  })
  if (!existing) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })

  try {
    const body    = patchSchema.parse(await req.json())
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data:  body,
    })

    return NextResponse.json({ ok: true, variant: { ...variant, precio_extra: Number(variant.precio_extra) } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Variant patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  const productId = parseId(params.id)
  const variantId = parseId(params.variantId)
  if (!productId || !variantId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  if (!await guardProduct(productId, session.businessId)) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const existing = await prisma.productVariant.findFirst({
    where: { id: variantId, product_id: productId },
  })
  if (!existing) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })

  await prisma.productVariant.update({ where: { id: variantId }, data: { is_active: false } })

  return NextResponse.json({ ok: true })
}
