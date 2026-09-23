// Imprime el consumo acumulado de un pedido/ticket abierto — NO cambia su
// estado. Reusa el patrón de impresión (Blob URL) de TicketPDF.ts. Compartido
// entre Pedidos (OrderDetalleModal) y el multi-ticket del POS (TicketPanel).

import { esc, openPrintWindow } from './TicketPDF'

export interface CorteItem {
  product_name: string
  variant_label?: string | null
  quantity: number
  subtotal_usd: number
}

export interface CorteOptions {
  // Ya formateado por el caller: "Pedido PED-00042" o "Ticket 1".
  docLabel: string
  clientName: string | null
  items: CorteItem[]
  totalUsd: number
  totalBs: number
  businessName: string
}

const fUSD = (n: number) => '$' + n.toFixed(2)
const fBs  = (n: number) =>
  'Bs. ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function generarCorteConsumoPDF(options: CorteOptions): void {
  const today = new Date().toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;max-width:420px;margin:16px auto;color:#222;background:#fff}
    .hdr{text-align:center;padding-bottom:10px;border-bottom:2px dashed #222;margin-bottom:10px}
    .biz{font-size:16px;font-weight:700}
    .badge{font-size:11px;font-weight:700;color:#cc2200;margin-top:4px}
    .sub{font-size:11px;color:#555;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th{border-bottom:1px solid #ccc;padding:5px 0;text-align:left;font-size:11px}
    td{padding:5px 0;border-bottom:1px dotted #ddd;font-size:11px}
    .r{text-align:right}
    .totals{margin-top:8px}
    .trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
    .trow.main{font-size:15px;font-weight:700;border-top:2px solid #222;padding-top:8px;margin-top:6px}
    .footer{margin-top:16px;padding-top:8px;border-top:1px dashed #222;font-size:10px;color:#777;text-align:center}
    @media print{@page{size:auto;margin:8mm}}
  `

  const rows = options.items.map((i) => `
    <tr>
      <td>${esc(i.product_name)}${i.variant_label ? ` <span style="color:#888">(${esc(i.variant_label)})</span>` : ''}</td>
      <td class="r">${esc(i.quantity.toString())}</td>
      <td class="r">${esc(fUSD(i.subtotal_usd))}</td>
    </tr>
  `).join('')

  const html = [
    '<div class="hdr">',
    `  <div class="biz">${esc(options.businessName)}</div>`,
    '  <div class="badge">CORTE DE CONSUMO — NO ES FACTURA</div>',
    `  <div class="sub">${esc(options.docLabel)}</div>`,
    options.clientName ? `  <div class="sub">Cliente: ${esc(options.clientName)}</div>` : '',
    `  <div class="sub">${esc(today)}</div>`,
    '</div>',
    `<table><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">USD</th></tr></thead><tbody>${rows}</tbody></table>`,
    '<div class="totals">',
    `  <div class="trow"><span>Total USD</span><span>${esc(fUSD(options.totalUsd))}</span></div>`,
    `  <div class="trow main"><span>Total Bs</span><span>${esc(fBs(options.totalBs))}</span></div>`,
    '</div>',
    '<div class="footer">Cuenta abierta — sigue activo y editable.</div>',
  ].join('\n')

  openPrintWindow(html, css)
}
