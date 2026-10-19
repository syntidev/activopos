import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { parsePrintSettings } from '@/lib/print-settings'
import { logError } from '@/lib/safe-log'
import type { ShippingData } from '@/lib/shipping'

// Datos de envío de un pedido (por order_id) o de la venta que lo cobró (por
// sale_id). Sin precios ni totales: alimenta la etiqueta 58 mm y "Copiar datos".
export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    const sp      = req.nextUrl.searchParams
    const orderId = Number(sp.get('order_id'))
    const saleId  = Number(sp.get('sale_id'))
    if (!Number.isInteger(orderId) && !Number.isInteger(saleId)) {
      return NextResponse.json({ error: 'order_id o sale_id requerido' }, { status: 400 })
    }

    const order = await db.order.findFirst({
      where:   Number.isInteger(orderId) && orderId > 0 ? { id: orderId } : { sale_id: saleId }, // business_id inyectado
      include: { items: { select: { quantity: true } } },
    })
    if (!order || order.delivery_type !== 'delivery') {
      return NextResponse.json({ ok: true, delivery: false })
    }

    const biz = await db.business.findUnique({
      where:  { id: session.businessId },
      select: { name: true, settings: true },
    })

    const data: ShippingData = {
      orderNumber:  order.order_number,
      businessName: biz?.name ?? '',
      // El snapshot de envío (ship_*) manda; los campos viejos solo cubren pedidos anteriores a él.
      recipient:    (order.ship_nombre ?? order.recipient_name ?? order.client_name ?? '').trim(),
      cedula:       order.ship_cedula ?? order.client_cedula ?? '',
      phone:        order.ship_telefono ?? order.client_phone ?? '',
      address:      (order.ship_direccion ?? order.delivery_address ?? '').trim(),
      // "Método de pago: X" es dato interno de cobro: no va en la etiqueta.
      notes:        (order.notes ?? '').replace(/^Método de pago:.*$/m, '').trim(),
      units:        Math.max(1, Math.ceil(order.items.reduce((a, i) => a + Number(i.quantity), 0))),
    }

    return NextResponse.json({
      ok: true,
      delivery: true,
      business_id: session.businessId,
      codepage: parsePrintSettings(biz?.settings).codepage,
      data,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('shipping-data error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
