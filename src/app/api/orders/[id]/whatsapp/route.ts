import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getActiveRate, formatBs, formatUsd } from '@/lib/bcv'

interface CobroData {
  pago_movil_banco?:    string
  pago_movil_telefono?: string
  pago_movil_titular?:  string
  pago_movil_cedula?:   string
  zelle_contacto?:      string
  zelle_titular?:       string
  binance_id?:          string
  zinli_correo?:        string
}

const buildPaymentLines = (cobro: CobroData | null): string[] => {
  if (!cobro) return []

  const lines: string[] = []

  if (cobro.pago_movil_telefono) {
    if (cobro.pago_movil_banco)   lines.push(`• Banco: ${cobro.pago_movil_banco}`)
    lines.push(`• Pago Móvil: ${cobro.pago_movil_telefono}`)
    if (cobro.pago_movil_titular) lines.push(`• Titular: ${cobro.pago_movil_titular}`)
    if (cobro.pago_movil_cedula)  lines.push(`• Cédula: ${cobro.pago_movil_cedula}`)
  }

  if (cobro.zelle_contacto) {
    lines.push(`• Zelle: ${cobro.zelle_contacto}`)
    if (cobro.zelle_titular) lines.push(`• Titular: ${cobro.zelle_titular}`)
  }

  if (cobro.binance_id)   lines.push(`• Binance ID: ${cobro.binance_id}`)
  if (cobro.zinli_correo) lines.push(`• Zinli: ${cobro.zinli_correo}`)

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

    const clientName = order.client_name ?? 'Cliente'
    const bizName    = biz?.name ?? 'nuestro negocio'
    const totalUsd   = Number(order.total_usd)
    const cobro      = (biz?.cobro_data ?? null) as CobroData | null
    const payLines   = buildPaymentLines(cobro)

    const itemLines = order.items.map(item => {
      const qty   = Number(item.quantity)
      const label = item.variant_label ? ` (${item.variant_label})` : ''
      return `• ${item.product_name}${label} × ${qty} — $${formatUsd(Number(item.subtotal_usd))}`
    })

    const lines: string[] = [
      `¡Hola ${clientName}! 👋`,
      `Tu pedido en *${bizName}* está listo para procesar.`,
      '',
      `🛒 *ORDEN #${order.order_number}*`,
      ...itemLines,
    ]

    if (Number(order.delivery_fee) > 0) {
      lines.push(`🚚 Delivery: $${formatUsd(Number(order.delivery_fee))}`)
    }

    lines.push(
      '',
      `💰 *Total: $${formatUsd(totalUsd)}*`,
      `   (Bs. ${formatBs(totalUsd, rate)} al cambio BCV)`,
    )

    if (payLines.length > 0) {
      lines.push('', '📲 *Para confirmar, realiza el pago a:*', ...payLines)
    }

    if (order.client_address) {
      lines.push('', `📍 *Dirección:* ${order.client_address}`)
    }

    if (order.notes) {
      lines.push('', `📝 *Notas:* ${order.notes}`)
    }

    lines.push('', 'Envíanos el comprobante y procesamos', 'tu pedido de inmediato. ¡Gracias! 🙌')

    const mensaje      = lines.join('\n')
    const phone        = (order.client_phone ?? '').replace(/[^0-9]/g, '')
    const whatsapp_url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`

    return NextResponse.json({ ok: true, mensaje, whatsapp_url })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
