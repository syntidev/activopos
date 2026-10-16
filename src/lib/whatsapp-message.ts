// Constructor ÚNICO de mensajes de WhatsApp: pedido del catálogo/asistente
// (cliente → negocio), botón verde de Pedidos (negocio → cliente) y comprobante
// de venta. Puro y sin dependencias: corre en servidor y cliente.
//
// Reglas: sin emojis (en WhatsApp de escritorio para Windows salen como �),
// USD y Bs siempre juntos con la tasa, y nunca "Sin especificar": un dato
// ausente se omite.

export interface WaLine {
  name:         string
  qty:          number
  subtotalUsd:  number
  variantLabel?: string | null
}

export type WaFulfillment =
  | { type: 'pickup' }
  | { type: 'delivery'; recipient?: string | null; address?: string | null }

export interface WaMessageInput {
  /** Encabezado: 'pedido' = "Pedido ORDEN", 'comprobante' = "Comprobante de venta ORDEN". */
  kind:            'pedido' | 'comprobante'
  /** A quién va dirigido: 'client' abre con saludo al cliente, 'business' lista los datos del cliente. */
  audience:        'client' | 'business'
  businessName?:   string | null
  orderNumber:     string
  clientName?:     string | null
  clientPhone?:    string | null
  /** Solo se imprime al negocio (audience 'business'); nunca en el mensaje al cliente. */
  clientCedula?:   string | null
  lines:           WaLine[]
  deliveryFeeUsd?: number
  totalUsd:        number
  /** Tasa BCV usada: Bs = USD x tasa. */
  rate:            number
  paymentMethod?:  string | null
  fulfillment?:    WaFulfillment | null
  /** Sector / referencia del cliente (no es la dirección de entrega). */
  sector?:         string | null
  notes?:          string | null
  /** Datos de cobro del negocio (pago móvil, Zelle...) ya formateados, una línea c/u. */
  paymentLines?:   string[]
}

const clean = (v: string | null | undefined): string => (v ?? '').trim()

export function waUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

/** Bs con formato sellado `Bs. 8,951.73` (determinista: no depende del ICU del servidor). */
export function waBs(usd: number, rate: number): string {
  const fixed = (Math.round(usd * rate * 100) / 100).toFixed(2)
  const [int, dec] = fixed.split('.')
  return `Bs. ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
}

function qtyLabel(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 1000) / 1000)
}

export function buildWhatsAppMessage(m: WaMessageInput): string {
  const lines: string[] = []
  const biz = clean(m.businessName)
  const name = clean(m.clientName)

  if (m.audience === 'client') {
    lines.push(`Hola${name ? ` ${name}` : ''}${biz ? `, te escribe ${biz}` : ''}.`)
    lines.push(m.kind === 'comprobante' ? 'Este es tu comprobante de venta.' : 'Este es el detalle de tu pedido.')
  } else if (biz) {
    lines.push(`*${biz}*`)
  }

  lines.push('', `*${m.kind === 'comprobante' ? 'Comprobante de venta' : 'Pedido'} ${m.orderNumber}*`)

  if (m.audience === 'business') {
    if (name) lines.push(`Cliente: ${name}`)
    if (clean(m.clientPhone)) lines.push(`WhatsApp: ${clean(m.clientPhone)}`)
    if (clean(m.clientCedula)) lines.push(`Cédula: ${clean(m.clientCedula)}`)
    if (clean(m.sector)) lines.push(`Sector: ${clean(m.sector)}`)
  }

  lines.push('', '*Productos:*')
  for (const l of m.lines) {
    const variant = clean(l.variantLabel) ? ` (${clean(l.variantLabel)})` : ''
    lines.push(`- ${l.name}${variant} x${qtyLabel(l.qty)}: ${waUsd(l.subtotalUsd)} / ${waBs(l.subtotalUsd, m.rate)}`)
  }

  if ((m.deliveryFeeUsd ?? 0) > 0) {
    const fee = m.deliveryFeeUsd as number
    lines.push(`- Delivery: ${waUsd(fee)} / ${waBs(fee, m.rate)}`)
  }

  lines.push(
    '',
    `*Total: ${waUsd(m.totalUsd)}*`,
    `${waBs(m.totalUsd, m.rate)} (tasa BCV ${m.rate.toFixed(2)})`,
  )

  if (clean(m.paymentMethod)) lines.push('', `Método de pago: ${clean(m.paymentMethod)}`)

  const f = m.fulfillment
  if (f?.type === 'pickup') {
    lines.push('Entrega: retiro en tienda')
    if (m.audience === 'client' && clean(m.sector)) lines.push(`Sector: ${clean(m.sector)}`)
  } else if (f?.type === 'delivery') {
    lines.push('Entrega: envío a domicilio')
    if (clean(f.recipient)) lines.push(`Recibe: ${clean(f.recipient)}`)
    if (clean(f.address)) lines.push(`Dirección: ${clean(f.address)}`)
    if (m.audience === 'client' && clean(m.sector)) lines.push(`Sector: ${clean(m.sector)}`)
  }

  if (m.paymentLines && m.paymentLines.length > 0) {
    lines.push('', '*Para pagar:*', ...m.paymentLines)
  }
  if (clean(m.notes)) lines.push('', `Notas: ${clean(m.notes)}`)

  if (m.audience === 'client') {
    lines.push('', m.kind === 'comprobante' ? 'Gracias por tu compra.' : 'Envíanos el comprobante de pago y procesamos tu pedido. Gracias.')
  }

  return lines.join('\n')
}

// wa.me exige código de país. Los teléfonos se guardan como los escribe el
// negocio: 0414-1234567, +58 412 1234567, 4141234567. Sin 58 al frente el
// enlace abre un chat con un número inexistente.
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''            // sin teléfono: wa.me/ abre sin destinatario
  if (digits.startsWith('0'))  return '58' + digits.slice(1)
  if (digits.startsWith('58')) return digits
  return '58' + digits
}

/** true si el teléfono, ya internacional, sirve para abrir un chat (11 a 15 dígitos). */
export function isValidWaPhone(phone: string | null | undefined): boolean {
  return /^\d{11,15}$/.test(normalizePhone(phone ?? ''))
}

/** Enlace https://wa.me al chat del teléfono con el texto. null si el teléfono no es válido. */
export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  if (!isValidWaPhone(phone)) return null
  return `https://wa.me/${normalizePhone(phone ?? '')}?text=${encodeURIComponent(message)}`
}

/** Enlace wa.me SIN destinatario (el usuario elige el chat): para cuando no hay teléfono. */
export function whatsappPickChatUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
