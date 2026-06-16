// Generates printable tickets and quotes — opens a new window via Blob URL and calls print()
// No external dependencies required.

import type { TicketState, TicketTotals } from '@/lib/pos'

/* ── Types ── */

export interface PrintTicketData {
  ticketNumber: string
  businessName: string
  cashierName: string
  soldAt: string
  clientName?: string
  items: Array<{
    productName: string
    saleMode: string
    quantity: number
    pricePerUnitUsd: number
    subtotalBs: number
  }>
  subtotalUsd: number
  discountUsd: number
  totalUsd: number
  totalBs: number
  rateUsed: number
  notes?: string
  payments?: Array<{ methodName: string; amountBs: number }>
}

export interface QuotePDFOptions {
  showUsd: boolean
  showBs: boolean
  validityDays: number
  notes: string
}

/* ── Formatting ── */

const fUSD = (n: number) => '$' + n.toFixed(2)
const fBs  = (n: number) =>
  'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fQty = (n: number, mode: string) =>
  mode === 'weight'
    ? n.toFixed(3) + ' kg'
    : n % 1 === 0
      ? n.toString() + ' und'
      : n.toFixed(2) + ' und'

/* ── XSS protection: escape all user-controlled strings ── */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ── Safe print helper via Blob URL (avoids document.write) ── */
function openPrintWindow(html: string, css: string): void {
  const fullDoc = [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head><meta charset="utf-8">',
    '<title>ActivoPOS — Ticket</title>',
    `<style>${css}</style>`,
    '</head><body>',
    html,
    '</body></html>',
  ].join('')

  const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)

  const win = window.open(url, '_blank', 'width=900,height=650,toolbar=no,scrollbars=yes')
  if (!win) {
    URL.revokeObjectURL(url)
    // eslint-disable-next-line no-alert
    alert('Activa las ventanas emergentes para imprimir. Busca el ícono bloqueado en la barra de direcciones.')
    return
  }

  // Give the browser time to render the blob before triggering print
  const cleanup = () => { URL.revokeObjectURL(url) }
  setTimeout(() => {
    win.print()
    win.addEventListener('afterprint', () => { win.close(); cleanup() }, { once: true })
    // Fallback cleanup if afterprint never fires (some browsers)
    setTimeout(cleanup, 30_000)
  }, 400)
}

/* ── Thermal ticket (80mm / 58mm) ── */

export function generarTicketPDF(data: PrintTicketData, format: '58mm' | '80mm' = '80mm'): void {
  const w = format === '58mm' ? '58mm' : '80mm'

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;width:${w};color:#000;background:#fff;padding:4mm}
    .c{text-align:center}.r{text-align:right}
    .biz{font-size:14px;font-weight:700}
    .meta{font-size:9px;color:#444}
    hr{border:none;border-top:1px dashed #000;margin:5px 0}
    .row{display:flex;justify-content:space-between;align-items:baseline}
    .iname{font-size:10px;margin-top:3px}
    .iprice{font-size:11px}
    .total-bs{font-size:16px;font-weight:700;text-align:center;margin:4px 0}
    .footer{text-align:center;font-size:9px;margin-top:8px;color:#555}
    @media print{@page{size:${w} auto;margin:0}body{padding:3mm}}
  `

  const items = data.items.map(i => [
    `<div class="iname">${esc(i.productName)}</div>`,
    `<div class="row iprice">`,
    `  <span>${esc(fQty(i.quantity, i.saleMode))} &times; ${esc(fUSD(i.pricePerUnitUsd))}</span>`,
    `  <span>${esc(fBs(i.subtotalBs))}</span>`,
    `</div>`,
  ].join('')).join('')

  const payments = data.payments?.map(p =>
    `<div class="row"><span>${esc(p.methodName)}</span><span>${esc(fBs(p.amountBs))}</span></div>`
  ).join('') ?? ''

  const html = [
    `<div class="c">`,
    `  <div class="biz">${esc(data.businessName)}</div>`,
    `  <div class="meta">${esc(data.soldAt)}</div>`,
    `  <div class="meta">Cajero: ${esc(data.cashierName)}</div>`,
    data.clientName ? `  <div class="meta">Cliente: ${esc(data.clientName)}</div>` : '',
    `</div>`,
    `<hr/>`,
    `<div class="meta">TICKET #${esc(data.ticketNumber)}</div>`,
    `<hr/>`,
    items,
    `<hr/>`,
    data.discountUsd > 0
      ? `<div class="row"><span>Descuento</span><span>-${esc(fUSD(data.discountUsd))}</span></div>`
      : '',
    `<div class="row"><span>Total USD</span><span>${esc(fUSD(data.totalUsd))}</span></div>`,
    `<div class="total-bs">${esc(fBs(data.totalBs))}</div>`,
    `<div class="meta c">Tasa: ${esc(fBs(data.rateUsed))} / USD</div>`,
    payments ? `<hr/>${payments}` : '',
    data.notes ? `<hr/><div class="meta">${esc(data.notes)}</div>` : '',
    `<div class="footer">&mdash; Gracias por su compra &mdash;</div>`,
  ].join('\n')

  openPrintWindow(html, css)
}

/* ── Quote / Cotización (Letter) ── */

export function generarCotizacionPDF(
  ticket: TicketState,
  totals: TicketTotals,
  options: QuotePDFOptions,
  meta: { businessName: string; cashierName: string; ticketNumber?: string }
): void {
  const rate   = ticket.rate || 1
  const today  = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const expiry = new Date(Date.now() + options.validityDays * 86_400_000)
    .toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;max-width:720px;margin:20px auto;color:#222;background:#fff}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #222;margin-bottom:16px}
    .biz{font-size:22px;font-weight:700}
    .doc-title{font-size:18px;font-weight:700;color:#444;text-align:right}
    .sub{font-size:11px;color:#555}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#f2f2f2;padding:7px 8px;text-align:left;border:1px solid #ccc;font-size:11px}
    td{padding:7px 8px;border:1px solid #ccc}
    .r{text-align:right}
    .totals{margin-top:8px;margin-left:auto;width:300px}
    .trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
    .trow.main{font-size:15px;font-weight:700;border-top:2px solid #222;padding-top:8px;margin-top:6px}
    .notes-box{margin-top:16px;padding:10px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:11px}
    .footer{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#777;text-align:center}
    .validity{color:#cc2200;font-size:10px}
    @media print{@page{size:letter;margin:15mm}}
  `

  const hasUsd = options.showUsd
  const hasBs  = options.showBs

  const theadCols = [
    '<th>Descripci&oacute;n</th>',
    '<th class="r">Cant.</th>',
    hasUsd ? '<th class="r">P.Unit (USD)</th><th class="r">Total (USD)</th>' : '',
    hasBs  ? '<th class="r">Total (Bs)</th>' : '',
  ].join('')

  const rows = ticket.items.map(i => {
    const subBs = i.subtotal_usd * rate
    return [
      '<tr>',
      `  <td>${esc(i.product_name)}</td>`,
      `  <td class="r">${esc(fQty(i.quantity, i.sale_mode))}</td>`,
      hasUsd ? `  <td class="r">${esc(fUSD(i.price_per_unit_usd))}</td><td class="r">${esc(fUSD(i.subtotal_usd))}</td>` : '',
      hasBs  ? `  <td class="r">${esc(fBs(subBs))}</td>` : '',
      '</tr>',
    ].join('')
  }).join('')

  const discountBlock = totals.discount_usd > 0 ? [
    `<div class="trow"><span>Subtotal</span><span>${hasUsd ? esc(fUSD(totals.subtotal_usd)) : ''}</span></div>`,
    `<div class="trow"><span>Descuento</span><span>${hasUsd ? '-' + esc(fUSD(totals.discount_usd)) : ''}</span></div>`,
  ].join('') : ''

  const html = [
    '<div class="hdr">',
    '  <div>',
    `    <div class="biz">${esc(meta.businessName)}</div>`,
    `    <div class="sub">${esc(today)}</div>`,
    `    <div class="sub">Atendido por: ${esc(meta.cashierName)}</div>`,
    '  </div>',
    '  <div>',
    '    <div class="doc-title">COTIZACI&Oacute;N</div>',
    meta.ticketNumber ? `    <div class="sub r">N&deg; ${esc(meta.ticketNumber)}</div>` : '',
    `    <div class="validity r">V&aacute;lida hasta: ${esc(expiry)}</div>`,
    '  </div>',
    '</div>',
    ticket.client_name
      ? `<div style="margin-bottom:12px"><strong>Cliente:</strong> ${esc(ticket.client_name)}</div>`
      : '',
    `<table><thead><tr>${theadCols}</tr></thead><tbody>${rows}</tbody></table>`,
    '<div class="totals">',
    discountBlock,
    hasUsd ? `<div class="trow"><span>Total USD</span><span>${esc(fUSD(totals.total_usd))}</span></div>` : '',
    hasBs  ? `<div class="trow main"><span>Total Bs</span><span>${esc(fBs(totals.total_bs))}</span></div>` : '',
    hasUsd && hasBs
      ? `<div style="font-size:10px;color:#888;text-align:right">Tasa: ${esc(fBs(rate))} / USD</div>`
      : '',
    '</div>',
    options.notes
      ? `<div class="notes-box"><strong>Observaciones:</strong> ${esc(options.notes)}</div>`
      : '',
    '<div class="footer">',
    `  Esta cotizaci&oacute;n es v&aacute;lida por ${options.validityDays} d&iacute;as contados desde su fecha de emisi&oacute;n.<br>`,
    '  ActivoPOS &mdash; Sistema de Punto de Venta',
    '</div>',
  ].join('\n')

  openPrintWindow(html, css)
}
