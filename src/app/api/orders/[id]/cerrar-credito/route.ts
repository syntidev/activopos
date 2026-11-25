import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'
import { PriceModeError } from '@/lib/price-mode'
import { lenientCheckoutCedula } from '@/lib/customer-identity'
import { buildOrderSaleLines, deductOrderStockTx } from '@/lib/order-sale'
import { clientDebt } from '@/lib/client-credit'

type Context = { params: { id: string } }

// Mismo contrato de plazo que el POS (POST /api/sales): preset 7/14/21/30 o personalizado, con su vencimiento y notas.
const schema = z.object({
  credit_days:  z.number().int().positive().max(365).optional(),
  due_date:     z.string().datetime().optional(),
  credit_notes: z.string().max(500).optional(),
})

class CreditError extends Error {
  constructor(readonly status: number, message: string, readonly field: string, readonly code: string, readonly extra: Record<string, unknown> = {}) { super(message) }
}

const DAY_MS = 86_400_000

// PERMISOS — INTENCIONAL: sin guard de rol, igual que cobrar. La autorización de crédito la decide un admin en la ficha del cliente
// (credit_authorized); el mostrador solo ejecuta el cierre. Sellado en MATRIZ_..._SELLADA.md (#2).

/* ── POST /api/orders/[id]/cerrar-credito — convierte el pedido en una venta a CRÉDITO (CxC) sin cambiar su etapa ── */

export async function POST(req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos', field: 'credit_days', code: 'INVALID_BODY' }, { status: 400 })
  }
  if (body.credit_days === undefined && body.due_date === undefined) {
    return NextResponse.json({ error: 'Indica el plazo del crédito (días o fecha de vencimiento).', field: 'credit_days', code: 'TERM_REQUIRED' }, { status: 422 })
  }

  try {
    const { session } = await getAuthenticatedTenant()
    const { rate } = await getActiveRate(session.businessId) // red fuera del $transaction

    const now = Date.now()
    const dueDate = body.due_date ? new Date(body.due_date) : new Date(now + (body.credit_days ?? 0) * DAY_MS)
    if (dueDate.getTime() <= now) {
      return NextResponse.json({ error: 'El vencimiento debe ser una fecha futura.', field: 'due_date', code: 'DUE_DATE_PAST' }, { status: 422 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cerrojo del pedido: un cobro y un cierre a crédito (o dos cierres) no corren a la vez.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${session.businessId} FOR UPDATE`
      const order = await tx.order.findFirst({ where: { id: orderId, business_id: session.businessId }, include: { items: true } })
      if (!order)                    throw new CreditError(404, 'Pedido no encontrado', 'order', 'ORDER_NOT_FOUND')
      if (order.sale_id !== null)    throw new CreditError(409, 'Este pedido ya fue cobrado o cerrado a crédito', 'order', 'ALREADY_COBRADO')
      if (order.status === 'cancelled') throw new CreditError(422, 'El pedido está cancelado', 'order', 'ORDER_TERMINAL')

      // El cliente debe ser de ESTE negocio (business_id de la sesión) y tener crédito autorizado por un admin.
      const client = order.client_id === null ? null
        : await tx.client.findFirst({ where: { id: order.client_id, business_id: session.businessId }, select: { id: true, name: true, credit_authorized: true, credit_limit_usd: true } })
      if (!client) throw new CreditError(422, 'El pedido necesita un cliente registrado para cerrarse a crédito.', 'client', 'CLIENT_REQUIRED')
      if (!client.credit_authorized) throw new CreditError(422, 'El cliente no tiene crédito autorizado.', 'credit', 'CREDIT_NOT_AUTHORIZED')

      // Serializa cierres a crédito del MISMO cliente: el tope se evalúa sobre su saldo ya confirmado.
      await tx.$queryRaw`SELECT id FROM clients WHERE id = ${client.id} AND business_id = ${session.businessId} FOR UPDATE`

      const ctx   = { businessId: session.businessId, userId: session.userId }
      const lines = await buildOrderSaleLines(tx, ctx, order, rate)
      const { mode, saleItems, total_usd, total_bs } = lines

      const debt  = await clientDebt(tx, session.businessId, client.id)
      const limit = client.credit_limit_usd === null ? null : Number(client.credit_limit_usd)
      if (limit !== null && debt.saldo_por_cobrar_usd + total_usd > limit + 0.005) {
        const disponible = Math.max(0, Math.round((limit - debt.saldo_por_cobrar_usd) * 100) / 100)
        throw new CreditError(422, `Supera el límite de crédito del cliente (disponible $${disponible.toFixed(2)}).`, 'credit', 'CREDIT_LIMIT_EXCEEDED',
          { credit_limit_usd: limit, saldo_por_cobrar_usd: debt.saldo_por_cobrar_usd, total_usd, disponible_usd: disponible })
      }

      const ticket_number = await generateTicketNumber(session.businessId, tx)
      const clientCedula  = lenientCheckoutCedula(order.client_cedula).value
      // Igual que una venta a crédito del POS: status 'credit', origin 'credit', sin pagos y sin sold_at (el dinero entra con los abonos).
      const newSale = await tx.sale.create({
        data: {
          business_id: session.businessId, cashier_id: session.userId, ticket_number,
          status: 'credit', origin: 'credit', price_mode: mode,
          total_usd, total_bs, rate_used: rate,
          client_id: client.id, client_name: order.client_name ?? client.name, client_phone: order.client_phone, client_cedula: clientCedula,
          notes: order.notes, sold_at: null,
          due_date: dueDate, credit_days: body.credit_days ?? null, credit_notes: body.credit_notes ?? null,
          items: { create: saleItems },
        },
        select: { id: true },
      })

      // Stock: exactamente como el POS en una venta a crédito (descuenta al registrarla).
      await deductOrderStockTx(tx, ctx, order, lines, ticket_number)

      // NO cambia la etapa del pedido: solo se enlaza la venta (pago_estado pasa a 'a_credito').
      await tx.order.update({ where: { id: orderId }, data: { sale_id: newSale.id, client_cedula: clientCedula } })
      await tx.activityLog.createMany({
        data: [
          { business_id: session.businessId, user_id: session.userId, action: 'sale_paid', model_type: 'Sale', model_id: newSale.id,
            new_values: { ticket_number, total_usd, total_bs, rate } },
          { business_id: session.businessId, user_id: session.userId, action: 'order_credit_closed', model_type: 'Order', model_id: orderId,
            reason: body.credit_notes ?? null, new_values: { sale_id: newSale.id, total_usd, due_date: dueDate.toISOString(), pago_estado: 'a_credito' } },
        ],
      })
      return { sale_id: newSale.id, total_usd, saldo_pendiente_usd: total_usd }
    })

    return NextResponse.json({ ok: true, ...result, pago_estado: 'a_credito', due_date: dueDate.toISOString(), credit_days: body.credit_days ?? null })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof PriceModeError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof CreditError) return NextResponse.json({ error: err.message, field: err.field, code: err.code, ...err.extra }, { status: err.status })
    if (err instanceof Error && err.message === 'PRODUCTS_CHANGED') {
      return NextResponse.json({ error: 'Uno o más productos del pedido ya no están disponibles', field: 'items', code: 'PRODUCTS_CHANGED' }, { status: 422 })
    }
    console.error('cerrar-credito POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
