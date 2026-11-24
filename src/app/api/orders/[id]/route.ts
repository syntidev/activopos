import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ORDER_PAGO_INCLUDE, derivePago } from '@/lib/order-payment'

// PERMISOS — INTENCIONAL: sin guard de rol. cashier edita/cancela pedidos como admin.
// Atención al cliente, no dato sensible. Sellado en MATRIZ_ROLES_PERMISOS_SELLADA.md (#2).

const VALID_TRANSITIONS: Record<string, string[]> = {
  received:   ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  [],
}

const patchSchema = z.object({
  status: z.enum(['received', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled']),
  // Despachar un pedido sin cobrar: solo un administrador, con motivo (queda en la bitácora).
  override_reason: z.string().trim().min(3).max(200).optional(),
})

function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try { const a = JSON.parse(raw) as unknown; return Array.isArray(a) && typeof a[0] === 'string' ? a[0] : null } catch { return null }
}

/* ── GET /api/orders/[id] ── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const id = Number(params.id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const found = await db.order.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
      include: {
        items: true,
        client: { select: { id: true, business_id: true, name: true, phone: true, cedula: true, address: true, price_tier: true } },
        ...ORDER_PAGO_INCLUDE,
      },
    })

    if (!found) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    const { sale: _sale, ...order } = found
    void _sale
    const pago = derivePago(found)

    // Resumen del cliente: solo si pertenece a ESTE negocio (business_id de la sesión). Saldo por cobrar = ventas a crédito + saldos de
    // financiamiento rechazado ya cobrado. Todas las consultas pasan por el tenant layer.
    let client: Record<string, unknown> | null = null
    if (order.client && order.client.business_id === session.businessId) {
      const c = order.client
      const [previos, credito, rechazados] = await Promise.all([
        db.order.count({ where: { client_id: c.id, id: { not: id }, status: { not: 'cancelled' }, created_at: { lt: order.created_at } } }),
        db.sale.findMany({ where: { client_id: c.id, status: 'credit' }, select: { total_usd: true, abonos: { select: { amount_usd: true } } } }),
        db.order.findMany({ where: { client_id: c.id, financing_status: 'rejected', sale_id: { not: null } }, select: { total_usd: true, financing_status: true, ...ORDER_PAGO_INCLUDE } }),
      ])
      const saldoCxc = Math.round(credito.reduce((a, s) => a + Math.max(0, Number(s.total_usd) - s.abonos.reduce((x, ab) => x + Number(ab.amount_usd), 0)), 0) * 100) / 100
      const deudaFin = Math.round(rechazados.reduce((a, o) => a + derivePago(o).deuda_cliente_usd, 0) * 100) / 100
      client = {
        id: c.id, name: c.name, cedula: c.cedula, phone: c.phone, address: c.address, price_tier: c.price_tier,
        pedidos_previos: previos, saldo_cxc_usd: saldoCxc, deuda_financiamiento_usd: deudaFin, saldo_por_cobrar_usd: Math.round((saldoCxc + deudaFin) * 100) / 100,
      }
    }

    // Miniatura y SKU por línea (aditivo): primera foto del producto y SKU de la variante (o del producto).
    const [products, variants] = await Promise.all([
      db.product.findMany({ where: { id: { in: order.items.map((i) => i.product_id) } }, select: { id: true, sku: true, images: true } }),
      db.productVariant.findMany({ where: { id: { in: order.items.flatMap((i) => (i.variant_id ? [i.variant_id] : [])) } }, select: { id: true, sku: true } }),
    ])
    const items = order.items.map((i) => {
      const p = products.find((x) => x.id === i.product_id)
      return { ...i, image_url: firstImage(p?.images ?? null), sku: variants.find((v) => v.id === i.variant_id)?.sku ?? p?.sku ?? null }
    })

    return NextResponse.json({ ok: true, order: { ...order, client, items, pago_estado: pago.pago_estado, pago } })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

/* ── PATCH /api/orders/[id] ── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const { status, override_reason } = patchSchema.parse(body)

    const order = await prisma.order.findFirst({
      where: { id, business_id: session.businessId },
      select: { id: true, status: true, origin: true, total_usd: true, financing_status: true, ...ORDER_PAGO_INCLUDE },
    })

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `No se puede pasar de "${order.status}" a "${status}"` },
        { status: 422 }
      )
    }

    // Guardas de pago (no aplican a cuentas de mesa: se cierran por su propio cobro). financing_status NO participa: Cashea solo
    // registra; lo que cuenta es el estado de pago derivado (cobrado = inicial recibida + saldo asignado a Cashea).
    let overridden = false
    if ((order.origin as string) !== 'table' && (status === 'dispatched' || status === 'delivered')) {
      const pago = derivePago(order)
      if (!pago.puede_avanzar) {
        if (status === 'delivered') {
          return NextResponse.json(
            { error: 'Para entregar, el pedido debe estar cobrado o a crédito.', field: 'payment', code: 'PAYMENT_REQUIRED', pago_estado: pago.pago_estado }, { status: 422 })
        }
        if (!override_reason) {
          return NextResponse.json(
            { error: 'El pedido no está cobrado. Cóbralo o, si un administrador autoriza el despacho sin cobro, indica el motivo.', field: 'payment', code: 'PAYMENT_REQUIRED', pago_estado: pago.pago_estado }, { status: 422 })
        }
        if (session.role !== 'admin' && session.role !== 'super_admin') {
          return NextResponse.json({ error: 'Solo un administrador puede autorizar el despacho sin cobro.', field: 'override_reason', code: 'OVERRIDE_FORBIDDEN' }, { status: 403 })
        }
        overridden = true
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status }, include: { items: true } }),
      ...(overridden
        ? [prisma.activityLog.create({
            data: {
              business_id: session.businessId, user_id: session.userId, action: 'order_dispatch_override',
              model_type: 'Order', model_id: id, reason: override_reason,
              old_values: { status: order.status }, new_values: { status, pago_estado: 'por_cobrar' },
            },
          })]
        : []),
    ])

    return NextResponse.json({ ok: true, order: updated, ...(overridden ? { override: true } : {}) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('orders PATCH error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
