// Comprobante de venta: acciones compartidas por Pedidos→Cobrar y por el
// Historial (imprimir, WhatsApp, imagen). Solo cliente (usa fetch/canvas).

import { printSaleThermal } from '@/lib/thermal-print'
import { buildWhatsAppMessage, isValidWaPhone, whatsappUrl } from '@/lib/whatsapp-message'
import type { ThermalTicketData } from '@/types/thermal'

export type ComprobanteTicket = ThermalTicketData

export async function fetchComprobante(saleId: number): Promise<ComprobanteTicket> {
  const res = await fetch(`/api/sales/${saleId}/ticket-data`, { cache: 'no-store', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`No se pudo leer el comprobante (HTTP ${res.status}).`)
  const body = await res.json() as { ok: boolean; ticket: ThermalTicketData }
  return body.ticket
}

export interface PrintOutcome {
  ok:      boolean
  message: string
}

/**
 * Imprime por el mismo camino que el POS: QZ Tray si el equipo lo tiene activo
 * en Configuración → Impresión. Regla `sent`: el ticket HTML del navegador solo
 * se abre si NADA llegó a la impresora (si no, saldría impreso dos veces).
 */
export async function printComprobante(saleId: number): Promise<PrintOutcome> {
  const htmlUrl = `/api/sales/${saleId}/ticket`
  const r = await printSaleThermal(saleId)

  if (r.state === 'printed') return { ok: true, message: `Impreso en ${r.printer}.` }
  if (r.state === 'skipped') {
    window.open(htmlUrl, '_blank')
    return { ok: true, message: 'Comprobante abierto para imprimir desde el navegador.' }
  }
  if (r.sent) return { ok: false, message: `${r.message} Revisa la impresora antes de reimprimir.` }
  window.open(htmlUrl, '_blank')
  return { ok: false, message: `${r.message} Se abrió el comprobante para imprimirlo desde el navegador.` }
}

export function comprobanteMessage(t: ComprobanteTicket): string {
  return buildWhatsAppMessage({
    kind:          'comprobante',
    audience:      'client',
    businessName:  t.business.name,
    orderNumber:   t.sale.ticket_number,
    clientName:    t.sale.client_name,
    lines:         t.sale.items.map(i => ({
      name: i.name, qty: i.quantity, subtotalUsd: i.subtotal_usd, variantLabel: i.variant_label,
    })),
    totalUsd:      t.sale.total_usd,
    rate:          t.sale.rate,
    paymentMethod: t.sale.payments.map(p => p.method).join(', ') || null,
  })
}

/** Motivo por el que WhatsApp no puede abrirse, o null si sí. */
export function whatsappBlockedReason(t: ComprobanteTicket): string | null {
  if (!t.sale.client_phone) return 'La venta no tiene teléfono de cliente.'
  if (!isValidWaPhone(t.sale.client_phone)) return 'El teléfono del cliente no es válido para WhatsApp.'
  return null
}

export function comprobanteWhatsappUrl(t: ComprobanteTicket): string | null {
  return whatsappUrl(t.sale.client_phone, comprobanteMessage(t))
}

/* ── Imagen (canvas nativo, sin dependencias) ── */

const IMG_W    = 640
const PAD      = 32
const LINE     = 30
const FONT     = '"Inter", "Segoe UI", Arial, sans-serif'
// Papel de comprobante: blanco/negro fijos, no dependen del tema del dashboard.
const INK      = 'black'
const MUTED    = 'dimgray'
const PAPER    = 'white'

function bs(n: number): string {
  const [i, d] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  return `Bs. ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${d}`
}

/** Dibuja el comprobante en un canvas y lo devuelve como PNG. */
export function renderComprobanteImage(t: ComprobanteTicket): Promise<Blob> {
  const s = t.sale
  const rows: { left: string; right?: string; bold?: boolean; muted?: boolean; gap?: number }[] = [
    { left: t.business.name, bold: true },
    { left: 'Comprobante de venta', muted: true },
    { left: `N° ${s.ticket_number}`, bold: true },
  ]
  if (s.sold_at) rows.push({ left: new Date(s.sold_at).toLocaleString('es-VE'), muted: true })
  if (s.client_name) rows.push({ left: `Cliente: ${s.client_name}`, muted: true })
  rows.push({ left: '', gap: 8 })
  for (const i of s.items) {
    const label = `${i.name}${i.variant_label ? ` (${i.variant_label})` : ''} x${i.quantity}`
    rows.push({ left: label, right: `$${i.subtotal_usd.toFixed(2)}` })
  }
  rows.push({ left: '', gap: 8 })
  rows.push({ left: 'Total', right: `$${s.total_usd.toFixed(2)}`, bold: true })
  rows.push({ left: `Tasa BCV ${s.rate.toFixed(2)}`, right: bs(s.total_bs), muted: true })
  if (s.payments.length > 0) rows.push({ left: `Pago: ${s.payments.map(p => p.method).join(', ')}`, muted: true })
  if (t.business.footer) rows.push({ left: t.business.footer, muted: true })

  const height = PAD * 2 + rows.reduce((a, r) => a + LINE + (r.gap ?? 0), 0)
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('El navegador no permite generar la imagen.'))

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, IMG_W, height)
  let y = PAD
  for (const r of rows) {
    y += LINE + (r.gap ?? 0)
    ctx.font = `${r.bold ? '700' : '400'} 20px ${FONT}`
    ctx.fillStyle = r.muted ? MUTED : INK
    ctx.textAlign = 'left'
    ctx.fillText(r.left, PAD, y - 8, r.right ? IMG_W - PAD * 2 - 140 : IMG_W - PAD * 2)
    if (r.right) {
      ctx.textAlign = 'right'
      ctx.fillText(r.right, IMG_W - PAD, y - 8)
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
  })
}

export async function downloadComprobanteImage(t: ComprobanteTicket): Promise<void> {
  const blob = await renderComprobanteImage(t)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comprobante-${t.sale.ticket_number}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
