import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string } }

const patchSchema = z.object({
  reference: z.string().trim().max(50).nullable().optional(),
  notes:     z.string().trim().nullable().optional(),
})

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const purchase = await db.purchase.findFirst({
      where: { id }, // business_id inyectado
      include: {
        supplier: true,
        items: {
          include: { product: { select: { id: true, name: true, price_per_unit_usd: true } } },
        },
      },
    })
    if (!purchase) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    return NextResponse.json({
      ok: true,
      purchase: {
        ...purchase,
        total_usd: Number(purchase.total_usd),
        items: purchase.items.map(i => ({
          ...i,
          qty:      Number(i.qty),
          cost_usd: Number(i.cost_usd),
          product:  { ...i.product, price_per_unit_usd: i.product.price_per_unit_usd != null ? Number(i.product.price_per_unit_usd) : null },
        })),
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    let data: z.infer<typeof patchSchema>
    try {
      data = patchSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const existing = await db.purchase.findFirst({ where: { id } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    // Solo notes/reference son editables — items y status son inmutables post-creación
    const purchase = await db.purchase.update({
      where: { id }, // business_id inyectado
      data: {
        ...(data.reference !== undefined ? { reference: data.reference || null } : {}),
        ...(data.notes !== undefined     ? { notes: data.notes || null }         : {}),
      },
    })

    return NextResponse.json({ ok: true, purchase: { ...purchase, total_usd: Number(purchase.total_usd) } })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
