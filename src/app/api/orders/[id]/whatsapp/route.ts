import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getActiveRate } from '@/lib/bcv'
import { buildWhatsAppMessage, whatsappPickChatUrl, whatsappUrl } from '@/lib/whatsapp-message'
import { CobroDataSchema } from '@/lib/cobro-data'
import type { CobroData } from '@/lib/cobro-data'

// Bug real 2026-10-05: esto declaraba su PROPIA interfaz CobroData con claves
// PLANAS (pago_movil_telefono, zelle_contacto, binance_id, zinli_correo) que
// nunca existieron en lo que realmente guarda TabCobros.tsx / PATCH
// /api/config/cobros/data -- la forma real es ANIDADA (pago_movil.telefono,
// zelle.contacto...). El bloque de pago del mensaje nunca se ejecutaba, y
// PayPal/USDT ni siquiera estaban declarados. CobroDataSchema (importado) es
// la única fuente de verdad de esta forma -- la valida PATCH al guardar.
// safeParse en vez de asumir el shape: cobro_data es Json? nullable en Prisma,
// y un negocio que nunca tocó la pestaña Cobros puede tener null o un resto
// del formato plano legacy -- en cualquiera de los dos casos, sin líneas de
// pago (mismo comportamiento de "degradar sin romper" que ya tenía esta ruta).
const buildPaymentLines = (cobroRaw: unknown): string[] => {
  const parsed = CobroDataSchema.safeParse(cobroRaw)
  if (!parsed.success) return []
  const cobro: CobroData = parsed.data

  const lines: string[] = []

  const pm = cobro.pago_movil
  if (pm?.telefono) {
    if (pm.banco)     lines.push(`- Banco: ${pm.banco}`)
    lines.push(`- Pago Móvil: ${pm.telefono}`)
    if (pm.titular)   lines.push(`- Titular: ${pm.titular}`)
    if (pm.documento) lines.push(`- Cédula: ${pm.tipo_doc}-${pm.documento}`)
  }

  if (cobro.zelle?.contacto) {
    lines.push(`- Zelle: ${cobro.zelle.contacto}`)
    if (cobro.zelle.titular) lines.push(`- Titular: ${cobro.zelle.titular}`)
  }

  if (cobro.zinli?.contacto) {
    lines.push(`- Zinli: ${cobro.zinli.contacto}`)
    if (cobro.zinli.titular) lines.push(`- Titular: ${cobro.zinli.titular}`)
  }

  if (cobro.paypal?.contacto) {
    lines.push(`- PayPal: ${cobro.paypal.contacto}`)
    if (cobro.paypal.titular) lines.push(`- Titular: ${cobro.paypal.titular}`)
  }

  // Shape de Binance cambió de raíz: la interfaz plana vieja tenía un solo
  // binance_id (campo que nunca existió en los datos reales). Lo real guardado
  // es {contacto, titular} -- mismo molde que Zelle/Zinli/PayPal.
  if (cobro.binance?.contacto) {
    lines.push(`- Binance: ${cobro.binance.contacto}`)
    if (cobro.binance.titular) lines.push(`- Titular: ${cobro.binance.titular}`)
  }

  if (cobro.usdt?.wallet) {
    lines.push(`- USDT (${cobro.usdt.red || 'TRC20'}): ${cobro.usdt.wallet}`)
    if (cobro.usdt.titular) lines.push(`- Titular: ${cobro.usdt.titular}`)
  }

  return lines
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const id = Number(params.id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [order, biz, rate] = await Promise.all([
      db.order.findFirst({
        where:   { id }, // business_id inyectado por el tenant layer
        include: { items: true },
      }),
      // Business es la raíz del tenant (no tiene business_id) → no se filtra.
      db.business.findUnique({
        where:  { id: session.businessId },
        select: { name: true, cobro_data: true },
      }),
      getActiveRate(session.businessId).then(r => r.rate),
    ])

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    // El método de pago elegido en el catálogo viaja en la primera línea de notes.
    const METHOD_RE = /^Método de pago:\s*(.+)$/m
    const rawNotes  = order.notes ?? ''
    const method    = METHOD_RE.exec(rawNotes)?.[1]?.trim() ?? null
    const notes     = rawNotes.replace(METHOD_RE, '').trim()

    const isDelivery = order.delivery_type === 'delivery'
    const mensaje = buildWhatsAppMessage({
      kind:           'pedido',
      audience:       'client',
      businessName:   biz?.name ?? null,
      orderNumber:    order.order_number,
      clientName:     order.client_name,
      lines:          order.items.map(item => ({
        name:         item.product_name,
        qty:          Number(item.quantity),
        subtotalUsd:  Number(item.subtotal_usd),
        variantLabel: item.variant_label,
      })),
      deliveryFeeUsd: Number(order.delivery_fee),
      totalUsd:       Number(order.total_usd),
      // La tasa del pedido manda: es la que vio el cliente al ordenar.
      rate:           Number(order.rate_used) || rate,
      paymentMethod:  method,
      fulfillment:    isDelivery
        ? { type: 'delivery', recipient: order.recipient_name, address: order.delivery_address }
        : { type: 'pickup' },
      // client_address guarda el sector/referencia, NO la dirección de entrega.
      sector:         order.client_address,
      notes,
      paymentLines:   buildPaymentLines(biz?.cobro_data ?? null),
    })

    // Sin teléfono válido: wa.me sin destinatario para que el negocio elija el chat.
    const whatsapp_url = whatsappUrl(order.client_phone, mensaje) ?? whatsappPickChatUrl(mensaje)

    return NextResponse.json({ ok: true, mensaje, whatsapp_url })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
