import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
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
  try {
    const { db } = await getAuthenticatedTenant()

    const productId = req.nextUrl.searchParams.get('product_id')

    const entries = await db.inventoryEntry.findMany({
      where: {
        // business_id inyectado por el tenant layer
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
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await req.json()
    const data = entrySchema.parse(body)

    // Validación (fuera del $transaction) → tenant layer
    const product = await db.product.findFirst({
      where: { id: data.product_id, active: true }, // business_id inyectado
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    // $transaction en prisma base: business_id manual adentro
    const entry = await prisma.$transaction(async tx => {
      const newEntry = await tx.inventoryEntry.create({
        data: {
          business_id:       session.businessId,
          product_id:        data.product_id,
          quantity:          data.quantity,
          waste:             data.waste,
          cost_per_unit_usd: data.cost_per_unit_usd ?? null,
          supplier:          data.supplier ?? null,
          notes:             data.notes ?? null,
          created_by:        session.userId,
        },
        include: {
          product: { select: { id: true, name: true, base_unit_label: true } },
          user:    { select: { id: true, name: true } },
        },
      })

      if (data.cost_per_unit_usd != null && data.cost_per_unit_usd > 0) {
        await tx.product.update({
          where: { id: data.product_id, business_id: session.businessId },
          data:  { cost_per_unit_usd: data.cost_per_unit_usd },
        })
      }

      return newEntry
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
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Inventory entry error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
