import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { generateTicketNumber } from '@/lib/ticket'
import { PriceModeError, priceModeSchema } from '@/lib/price-mode'
import { DIVISA_BLOCKS_FINANCING_MESSAGE, FinancingError, assertFinancingEligible } from '@/lib/ticket-financing'
import { checkCedula, type CedulaCheck } from '@/lib/cedula'
import { lenientCheckoutCedula } from '@/lib/customer-identity'
import { buildOrderSaleLines, deductOrderStockTx } from '@/lib/order-sale'

type Context = { params: { id: string } }

const cobrarSchema = z.object({
  payment_method_id: z.number().int().positive(),
  reference:         z.string().max(100).optional(),
  // Cédula declarada/corregida al cobrar; si falta se usa la del pedido.
  cedula:            z.string().max(20).optional(),
  // Modo de precio con el que se cobra: si viene, se aplica y se guarda en el pedido; si no, el del pedido.
  price_mode:        priceModeSchema.optional(),
  // Solo con método financiador (Cashea): la inicial que ENTRÓ, con un método real. El saldo (total − inicial) queda asignado a Cashea.
  initial: z.object({
    payment_method_id: z.number().int().positive(),
    amount_usd:        z.number().positive().max(99_999_999),
    reference:         z.string().max(100).optional(),
  }).optional(),
})

// PERMISOS — INTENCIONAL: sin guard de rol. cashier cobra pedidos como admin (es la
// caja del mostrador). No expone costo/utilidad. Sellado en MATRIZ_..._SELLADA.md (#2).

/* ── POST /api/orders/[id]/cobrar — convert Order to a paid Sale ── */

export async function POST(req: NextRequest, { params }: Context) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: z.infer<typeof cobrarSchema>
  try {
    body = cobrarSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Se requiere método de pago' }, { status: 400 })
  }

  try {
    const { session, db } = await getAuthenticatedTenant()

    // Validar método de pago (fuera del $transaction) → tenant layer
    const pm = await db.paymentMethod.findFirst({
      where: { id: body.payment_method_id, is_active: true }, // business_id inyectado
      select: { id: true, name: true, is_financing: true },
    })
    if (!pm) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

    // La inicial solo existe al cobrar con financiamiento y se recibe con un método REAL (activo, del negocio, no financiador).
    if (body.initial && !pm.is_financing) {
      return NextResponse.json({ error: 'La inicial solo aplica al cobrar con el método financiador.', field: 'initial' }, { status: 422 })
    }
    if (body.initial) {
      const initialMethod = await db.paymentMethod.findFirst({
        where: { id: body.initial.payment_method_id, is_active: true, is_financing: false }, // business_id inyectado
        select: { id: true },
      })
      if (!initialMethod) return NextResponse.json({ error: 'La inicial debe recibirse con un método de pago real (no financiador).', field: 'initial' }, { status: 422 })
    }

    // Network call must be outside the transaction
    const { rate } = await getActiveRate(session.businessId)

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const { saleId } = await prisma.$transaction(async (tx) => {
      // Cerrojo de la fila del pedido: dos cobros (o un cobro y un cambio de modo) no corren a la vez.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND business_id = ${session.businessId} FOR UPDATE`
      const order = await tx.order.findFirst({
        where: { id: orderId, business_id: session.businessId },
        include: { items: true },
      })

      if (!order)                                          throw new Error('ORDER_NOT_FOUND')
      if (order.sale_id !== null)                          throw new Error('ALREADY_COBRADO')
      if (order.status === 'cancelled')                    throw new Error('ORDER_TERMINAL')
      // El método de pago es solo registro: cobrar se permite en CUALQUIER estado de financiamiento (Cashea no es compuerta de aprobación).
      // Con el método financiador solo se exige que el financiamiento siga siendo posible (activo, productos elegibles, no rechazado, BCV).
      if (pm.is_financing && order.financing_status === 'rejected') {
        throw new FinancingError(409, 'El financiamiento fue rechazado: cobra con otro método de pago.')
      }

      // Cédula: obligatoria (V/E natural) si el método es financiadora. Snapshot
      // en la venta y el pedido; Client.cedula solo si estaba nula.
      // Checkout sin fricción: la cédula y los datos de envío ya no bloquean el cobro; solo la financiadora exige V/E válida.
      const rawCedula = body.cedula ?? order.client_cedula
      const cedulaCheck: CedulaCheck = pm.is_financing
        ? checkCedula(rawCedula, pm.name, false)
        : { ok: true, value: lenientCheckoutCedula(rawCedula).value }
      if (!cedulaCheck.ok) throw new Error(`CEDULA_REQUIRED:${cedulaCheck.message}`)
      const clientCedula = cedulaCheck.value

      // SEC-01: precios desde la DB, nunca del snapshot ni del cliente. El modo (bcv | divisa) lo decide el pedido o el body.
      const ctx   = { businessId: session.businessId, userId: session.userId }
      const lines = await buildOrderSaleLines(tx, ctx, order, rate, body.price_mode)
      const { mode, saleItems, total_usd, total_bs } = lines
      if (pm.is_financing && mode === 'divisa') throw new FinancingError(409, DIVISA_BLOCKS_FINANCING_MESSAGE)
      const financingSnapshot = pm.is_financing
        ? await assertFinancingEligible(tx, session.businessId, order.items.map(i => i.product_id))
        : null

      const ticket_number = await generateTicketNumber(session.businessId, tx)

      // Líneas de pago: método normal = una línea por el total; financiador = inicial recibida (método real) + saldo asignado a Cashea.
      const inicialUsd = pm.is_financing && body.initial ? Math.round(body.initial.amount_usd * 100) / 100 : 0
      if (inicialUsd > 0 && inicialUsd >= total_usd - 0.005) throw new Error('INITIAL_COVERS_TOTAL')
      const inicialBs  = Math.round(inicialUsd * rate * 100) / 100
      const paymentLines = pm.is_financing
        ? [
            ...(inicialUsd > 0 && body.initial
              ? [{ payment_method_id: body.initial.payment_method_id, amount_bs: inicialBs, amount_usd: inicialUsd, reference: body.initial.reference ?? null, rate_used: rate }]
              : []),
            {
              payment_method_id: body.payment_method_id,
              amount_bs:         Math.round((total_bs - inicialBs) * 100) / 100,
              amount_usd:        Math.round((total_usd - inicialUsd) * 100) / 100,
              reference:         body.reference ?? null,
              rate_used:         rate,
            },
          ]
        : [{ payment_method_id: body.payment_method_id, amount_bs: total_bs, amount_usd: total_usd, reference: body.reference ?? null, rate_used: rate }]

      const newSale = await tx.sale.create({
        data: {
          business_id:   session.businessId,
          cashier_id:    session.userId,
          ticket_number,
          status:        'paid',
          origin:        'catalog',
          price_mode:    mode,
          // Solo una venta con línea financiadora lleva financiamiento (los reportes la cuentan aparte); cobrar con método normal no hereda el del pedido.
          ...(financingSnapshot
            ? {
                financing_status:   'approved',
                financing_provider: order.financing_provider ?? financingSnapshot.provider,
                financing_phrase:   order.financing_phrase ?? financingSnapshot.phrase,
              }
            : {}),
          total_usd,
          total_bs,
          rate_used:     rate,
          client_id:     order.client_id,
          client_name:   order.client_name,
          client_phone:  order.client_phone,
          client_cedula: clientCedula,
          notes:         order.notes,
          sold_at:       new Date(),
          items:         { create: saleItems },
          payments: { create: paymentLines },
        },
        select: { id: true },
      })

      await deductOrderStockTx(tx, ctx, order, lines, ticket_number)

      // Cobrar NO cambia la etapa: solo un pedido ya 'dispatched' se entrega al cobrar (el cobro era lo único que faltaba).
      await tx.order.update({
        where: { id: orderId },
        data:  {
          sale_id: newSale.id, client_cedula: clientCedula,
          ...(order.status === 'dispatched' ? { status: 'delivered' as const } : {}),
          ...(financingSnapshot && order.financing_status !== 'approved'
            ? { financing_status: 'approved', financing_provider: order.financing_provider ?? financingSnapshot.provider, financing_phrase: order.financing_phrase ?? financingSnapshot.phrase }
            : {}),
        },
      })
      if (financingSnapshot && order.financing_status !== 'approved') {
        await tx.activityLog.create({
          data: {
            business_id: session.businessId, user_id: session.userId, action: 'financing_status_changed',
            model_type: 'Order', model_id: orderId, reason: 'Cobro con el método financiador',
            old_values: { financing_status: order.financing_status }, new_values: { financing_status: 'approved' },
          },
        })
      }

      if (clientCedula && order.client_id !== null) {
        await tx.client.updateMany({
          where: { id: order.client_id, business_id: session.businessId, cedula: null },
          data:  { cedula: clientCedula },
        })
      }

      return { saleId: newSale.id }
    })

    return NextResponse.json({ ok: true, sale_id: saleId })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof FinancingError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof PriceModeError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Error) {
      if (err.message.startsWith('CEDULA_REQUIRED:')) {
        return NextResponse.json({ error: err.message.slice('CEDULA_REQUIRED:'.length), field: 'cedula' }, { status: 422 })
      }
      if (err.message === 'ORDER_NOT_FOUND')   return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
      if (err.message === 'ALREADY_COBRADO')   return NextResponse.json({ error: 'Este pedido ya fue cobrado' }, { status: 409 })
      if (err.message === 'ORDER_TERMINAL')    return NextResponse.json({ error: 'El pedido está cancelado' }, { status: 422 })
      if (err.message === 'INITIAL_COVERS_TOTAL') return NextResponse.json({ error: 'La inicial cubre el total: cobra con un método normal, sin financiamiento.', field: 'initial' }, { status: 422 })
      if (err.message === 'PRODUCTS_CHANGED')  return NextResponse.json({ error: 'Uno o más productos del pedido ya no están disponibles' }, { status: 422 })
    }
    console.error('cobrar POST error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
