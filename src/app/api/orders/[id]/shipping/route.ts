import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rate-limit'
import { logError } from '@/lib/safe-log'
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
    const { session, db } = await getAuthenticatedTenant()

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

    // Método: cambiarlo re-congela etiqueta y tipo en el pedido (quitarlo los deja en null).
    let methodSnapshot: { ship_metodo_label: string | null; ship_metodo_kind: string | null } | null = null
    if (body.ship_metodo_id !== undefined) {
      if (body.ship_metodo_id === null) {
        methodSnapshot = { ship_metodo_label: null, ship_metodo_kind: null }
      } else {
        const method = await db.businessShippingMethod.findFirst({ where: { id: body.ship_metodo_id }, select: { id: true, label: true, kind: true } }) // business_id inyectado
        if (!method) return fail('Método de envío inválido.', 'ship_metodo_id')
        methodSnapshot = { ship_metodo_label: method.label, ship_metodo_kind: method.kind }
      }
    }

    // Rastro de auditoría: quién (user_id), cuándo (created_at) y QUÉ CAMPOS cambió; nunca los valores,
    // que son datos personales del cliente. Mismo commit que el cambio. El pedido ya se verificó del negocio.
    const changed = Object.keys(body)
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id },
        data: {
          ...(body.ship_nombre    !== undefined && { ship_nombre: recipient, recipient_name: recipient }),
          ...(body.ship_cedula    !== undefined && { ship_cedula: cedula }),
          ...(body.ship_telefono  !== undefined && { ship_telefono: phone }),
          ...(body.ship_direccion !== undefined && { ship_direccion: address, delivery_address: address }),
          ...(body.ship_metodo_id !== undefined && { ship_metodo_id: body.ship_metodo_id, ...methodSnapshot }),
        },
        select: {
          id: true, order_number: true, ship_nombre: true, ship_cedula: true, ship_telefono: true,
          ship_direccion: true, ship_metodo_id: true, ship_metodo_label: true, ship_metodo_kind: true,
        },
      })
      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id:     session.userId,
          action:      'order_shipping_edited',
          model_type:  'Order',
          model_id:    id,
          new_values:  { fields: changed },
          ip_address:  getClientIp(req),
        },
      })
      return row
    })
    return NextResponse.json({ ok: true, order: updated })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    logError('order shipping PATCH error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
