import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

const stockSchema = z.object({
  type:          z.enum(['adjust', 'entry']),
  quantity:      z.number().refine(n => n !== 0, { message: 'quantity no puede ser cero' }),
  cost_per_unit: z.number().min(0).nullable().optional(),
  supplier:      z.string().max(120).optional(),
  notes:         z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const productId = Number(params.id)
  if (!Number.isFinite(productId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof stockSchema>
  try {
    body = stockSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, business_id: session.businessId, active: true },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const notes = body.notes?.trim() || (body.type === 'entry' ? 'Entrada de inventario' : 'Ajuste manual')

  const entry = await prisma.$transaction(async tx => {
    const newEntry = await tx.inventoryEntry.create({
      data: {
        business_id:       session.businessId,
        product_id:        productId,
        quantity:          body.quantity,
        waste:             0,
        cost_per_unit_usd: body.cost_per_unit ?? null,
        supplier:          body.supplier?.trim() || null,
        notes,
        created_by:        session.userId,
      },
      select: {
        id: true,
        quantity: true,
        waste: true,
        cost_per_unit_usd: true,
        notes: true,
        entered_at: true,
      },
    })

    if (body.cost_per_unit != null && body.cost_per_unit > 0) {
      await tx.product.update({
        where: { id: productId, business_id: session.businessId },
        data:  { cost_per_unit_usd: body.cost_per_unit },
      })
    }

    return newEntry
  })

  return NextResponse.json(
    {
      ok: true,
      entry: {
        ...entry,
        quantity:          Number(entry.quantity),
        waste:             Number(entry.waste),
        cost_per_unit_usd: entry.cost_per_unit_usd ? Number(entry.cost_per_unit_usd) : null,
      },
    },
    { status: 201 }
  )
}
