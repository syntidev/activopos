import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type RouteContext = { params: { id: string } }

function entryType(quantity: number, notes: string | null): 'entry' | 'adjust' | 'sale' {
  if (notes?.startsWith('VENTA')) return 'sale'
  return quantity >= 0 ? 'entry' : 'adjust'
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const productId = parseInt(params.id, 10)
    if (isNaN(productId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const dateStr = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    if (!dateSchema.safeParse(dateStr).success) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    const product = await db.product.findFirst({
      where: { id: productId }, // business_id inyectado por el tenant layer
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    const dayEnd   = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0))

    const entries = await db.inventoryEntry.findMany({
      where: {
        // business_id inyectado por el tenant layer
        product_id:  productId,
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
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
