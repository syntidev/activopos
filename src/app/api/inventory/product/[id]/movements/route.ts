import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type RouteContext = { params: { id: string } }

function entryType(quantity: number, notes: string | null): 'entry' | 'adjust' | 'sale' {
  if (notes?.startsWith('VENTA')) return 'sale'
  return quantity >= 0 ? 'entry' : 'adjust'
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const productId = parseInt(params.id, 10)
  if (isNaN(productId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const dateStr = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!dateSchema.safeParse(dateStr).success) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const bid = session.businessId

  const product = await prisma.product.findFirst({
    where: { id: productId, business_id: bid },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const dayEnd   = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))

  const entries = await prisma.inventoryEntry.findMany({
    where: {
      product_id:  productId,
      business_id: bid,
      entered_at:  { gte: dayStart, lt: dayEnd },
    },
    select: {
      id:                true,
      quantity:          true,
      cost_per_unit_usd: true,
      supplier:          true,
      notes:             true,
      entered_at:        true,
      user: { select: { name: true } },
    },
    orderBy: { entered_at: 'asc' },
  })

  return NextResponse.json({
    ok: true,
    movements: entries.map(e => {
      const qty = Number(e.quantity)
      return {
        id:                e.id,
        type:              entryType(qty, e.notes),
        quantity:          qty,
        cost_per_unit_usd: e.cost_per_unit_usd != null ? Number(e.cost_per_unit_usd) : null,
        supplier:          e.supplier,
        notes:             e.notes,
        created_at:        e.entered_at.toISOString(),
        user_name:         e.user.name,
      }
    }),
  })
}
