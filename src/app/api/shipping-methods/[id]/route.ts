import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { SHIPPING_WRITE_ROLES, toShippingMethodDTO } from '@/lib/shipping-methods'
import { logError } from '@/lib/safe-log'
import { SHIPPING_KINDS } from '@/types/shipping'
import type { ShippingKind } from '@/types/shipping'

// PATCH/DELETE de un método de envío. Solo 'admin' (SHIPPING_WRITE_ROLES). El `code` no se edita (es el
// identificador estable del método): para otro código, se crea uno nuevo.

const patchSchema = z.object({
  label:           z.string().trim().min(1).max(120).optional(),
  kind:            z.enum(SHIPPING_KINDS as [ShippingKind, ...ShippingKind[]]).optional(),
  requires_branch: z.boolean().optional(),
  active:          z.boolean().optional(),
  sort_order:      z.number().int().min(0).max(9999).optional(),
  instructions:    z.string().trim().max(2000).nullable().optional(),
}).strict()

const parseId = (raw: string): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (!SHIPPING_WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const parsed = patchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
    }

    const existing = await db.businessShippingMethod.findFirst({ where: { id }, select: { id: true } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const updated = await db.businessShippingMethod.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ ok: true, method: toShippingMethodDTO(updated) })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    logError('shipping-methods PATCH error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (!SHIPPING_WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.businessShippingMethod.findFirst({ where: { id }, select: { id: true } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Borrar dejaría los pedidos viejos sin método (FK ON DELETE SET NULL): mejor desactivarlo.
    const used = await db.order.count({ where: { ship_metodo_id: id } }) // business_id inyectado
    if (used > 0) {
      return NextResponse.json(
        { error: `El método tiene ${used} pedido(s). Desactívalo en vez de borrarlo.` },
        { status: 409 },
      )
    }
    await db.businessShippingMethod.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    logError('shipping-methods DELETE error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
