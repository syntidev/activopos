import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkCheckoutCedula, hasUsablePhone, normalizeClientPhone } from '@/lib/customer-identity'
import { validateAddress, validateShipping } from '@/lib/shipping'

// PATCH /api/orders/[id]/shipping — corrige el snapshot de envío (ship_*) de un pedido ANTES de
// imprimir la etiqueta. Mismo permiso que el resto de Pedidos (sin guard de rol, sellado en
// MATRIZ_ROLES_PERMISOS_SELLADA.md #2). business_id lo pone la capa de tenant desde la sesión.

const EDITABLE_STATUSES = ['received', 'preparing', 'ready']

const patchSchema = z.object({
  ship_nombre:    z.string().trim().min(1).max(120).optional(),
  ship_cedula:    z.string().trim().max(20).optional(),
  ship_telefono:  z.string().trim().max(20).optional(),
  ship_direccion: z.string().trim().max(500).optional(),
  ship_metodo_id: z.number().int().positive().nullable().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: 'Nada que actualizar' })

const fail = (error: string, field: string, status = 422): NextResponse =>
  NextResponse.json({ error, field }, { status })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const parsed = patchSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
    }
    const body = parsed.data

    const order = await db.order.findFirst({ where: { id } }) // business_id inyectado
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    if (order.delivery_type !== 'delivery') return fail('El pedido no es de envío.', 'delivery_type')
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: 'El pedido ya salió o se cerró: no se puede editar el envío.' }, { status: 409 })
    }

    let cedula = order.ship_cedula ?? order.client_cedula ?? ''
    if (body.ship_cedula !== undefined) {
      const check = checkCheckoutCedula(body.ship_cedula)
      if (!check.ok) return fail(check.message, 'ship_cedula')
      cedula = check.value
    }
    let phone = order.ship_telefono ?? order.client_phone ?? ''
    if (body.ship_telefono !== undefined) {
      if (!hasUsablePhone(body.ship_telefono)) return fail('Indica un teléfono válido.', 'ship_telefono')
      phone = normalizeClientPhone(body.ship_telefono)
    }
    let address = order.ship_direccion ?? order.delivery_address ?? ''
    if (body.ship_direccion !== undefined) {
      const addressError = validateAddress(body.ship_direccion)
      if (addressError) return fail(addressError, 'ship_direccion')
      address = body.ship_direccion
    }
    const recipient = body.ship_nombre ?? order.ship_nombre ?? order.recipient_name ?? order.client_name ?? ''

    const shippingError = validateShipping({ recipient, cedula, phone, address })
    if (shippingError) return fail(shippingError, 'delivery')

    if (body.ship_metodo_id !== undefined && body.ship_metodo_id !== null) {
      const method = await db.businessShippingMethod.findFirst({ where: { id: body.ship_metodo_id }, select: { id: true } }) // business_id inyectado
      if (!method) return fail('Método de envío inválido.', 'ship_metodo_id')
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        ...(body.ship_nombre    !== undefined && { ship_nombre: recipient, recipient_name: recipient }),
        ...(body.ship_cedula    !== undefined && { ship_cedula: cedula }),
        ...(body.ship_telefono  !== undefined && { ship_telefono: phone }),
        ...(body.ship_direccion !== undefined && { ship_direccion: address, delivery_address: address }),
        ...(body.ship_metodo_id !== undefined && { ship_metodo_id: body.ship_metodo_id }),
      },
      select: {
        id: true, order_number: true, ship_nombre: true, ship_cedula: true, ship_telefono: true,
        ship_direccion: true, ship_metodo_id: true,
      },
    })
    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('order shipping PATCH error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
