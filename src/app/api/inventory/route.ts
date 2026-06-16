import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const entrySchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive(),
  waste: z.number().min(0).default(0),
  cost_per_unit_usd: z.number().min(0).nullable().optional(),
  supplier: z.string().max(120).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const productId = req.nextUrl.searchParams.get('product_id')

  const entries = await prisma.inventoryEntry.findMany({
    where: {
      business_id: session.businessId,
      ...(productId ? { product_id: parseInt(productId) } : {}),
    },
    include: {
      product: { select: { id: true, name: true, base_unit_label: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { entered_at: 'desc' },
    take: 200,
  })

  const result = entries.map(e => ({
    ...e,
    quantity: Number(e.quantity),
    waste: Number(e.waste),
    cost_per_unit_usd: e.cost_per_unit_usd ? Number(e.cost_per_unit_usd) : null,
  }))

  return NextResponse.json({ ok: true, entries: result })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = await req.json()
    const data = entrySchema.parse(body)

    const product = await prisma.product.findFirst({
      where: { id: data.product_id, business_id: session.businessId, active: true },
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const entry = await prisma.inventoryEntry.create({
      data: {
        business_id: session.businessId,
        product_id: data.product_id,
        quantity: data.quantity,
        waste: data.waste,
        cost_per_unit_usd: data.cost_per_unit_usd ?? null,
        supplier: data.supplier ?? null,
        notes: data.notes ?? null,
        created_by: session.userId,
      },
      include: {
        product: { select: { id: true, name: true, base_unit_label: true } },
        user: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      entry: {
        ...entry,
        quantity: Number(entry.quantity),
        waste: Number(entry.waste),
        cost_per_unit_usd: entry.cost_per_unit_usd ? Number(entry.cost_per_unit_usd) : null,
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Inventory entry error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
