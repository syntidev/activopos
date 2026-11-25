import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { lenientCheckoutCedula } from '@/lib/customer-identity'
import { findExistingClientId, phoneForClient } from '@/lib/order-client'

type Context = { params: { id: string } }

// PERMISOS: mismo criterio que Clientes/Pedidos (cashier incluido); el rol restringido operador_reservas ya lo corta el middleware.

/* ── POST /api/orders/[id]/crear-cliente — crea (o enlaza, si ya existe) el cliente del pedido con sus datos ── */

export async function POST(_req: Request, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session } = await getAuthenticatedTenant()

    const out = await prisma.$transaction(async (tx) => {
      // Cerrojo: dos clics no crean dos clientes.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${session.businessId} FOR UPDATE`
      const order = await tx.order.findFirst({
        where:  { id: orderId, business_id: session.businessId },
        select: { id: true, client_id: true, client_name: true, client_phone: true, client_cedula: true },
      })
      if (!order) return { status: 404, body: { error: 'Pedido no encontrado', field: 'order', code: 'ORDER_NOT_FOUND' } }
      if (order.client_id !== null) return { status: 409, body: { error: 'El pedido ya tiene un cliente enlazado.', field: 'client', code: 'CLIENT_ALREADY_LINKED', client_id: order.client_id } }
      const name = order.client_name?.trim()
      if (!name) return { status: 422, body: { error: 'El pedido no tiene nombre de cliente.', field: 'client_name', code: 'CLIENT_NAME_REQUIRED' } }

      const cedula = lenientCheckoutCedula(order.client_cedula).value
      const existingId = await findExistingClientId(tx, session.businessId, { cedula, phone: order.client_phone })
      const clientId = existingId ?? (await tx.client.create({
        data:   { business_id: session.businessId, name, phone: phoneForClient(order.client_phone), cedula, origin: 'pos' },
        select: { id: true },
      })).id

      await tx.order.update({ where: { id: orderId }, data: { client_id: clientId } })
      return { status: 200, body: { ok: true, client_id: clientId, created: existingId === null } }
    })

    return NextResponse.json(out.body, { status: out.status })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('crear-cliente POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
