// Documento ÚNICO de cotización (solo USD): lo usan el POS, el módulo /cotizaciones y Ventas.
// buildQuotationHtml es pura (sin DOM); openQuotationPrint solo la abre en una ventana de impresión.

import { esc, openPrintDocument } from '@/components/pos/TicketPDF'
import { businessDateKey, shiftDateKey } from '@/lib/business-day'
import { logError } from '@/lib/safe-log'
import type { TicketState } from '@/lib/pos'
import type {
  QuotationDocBusiness, QuotationDocData, QuotationDocLine,
  QuotationDocSource, SaleDocSource,
} from '@/types/quotation-document'

const CENT_TOLERANCE = 0.005
const DAY_MS = 86_400_000

const r2 = (x: number): number => Math.round(x * 100) / 100
const clean = (s: string | null | undefined): string => (s ?? '').trim()

/** $1,290.00 — miles con coma, 2 decimales, sin espacio tras el $. */
export function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const trimDecimals = (n: number, max: number): string => String(Number(n.toFixed(max)))

/** "9 und"; el peso admite hasta 3 decimales y lleva kg. */
export function fmtQty(qty: number, mode: 'unit' | 'weight'): string {
  return `${trimDecimals(qty, 3)} ${mode === 'weight' ? 'kg' : 'und'}`
}

/** YYYY-MM-DD → dd/mm/yyyy (sin pasar por Date: no hay corrimiento de zona). */
export const fmtYmd = (ymd: string): string => ymd.split('-').reverse().join('/')

const ymdToUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Días enteros entre dos YYYY-MM-DD (negativo si `to` es anterior). */
export const daysBetweenYmd = (from: string, to: string): number =>
  Math.round((ymdToUtc(to) - ymdToUtc(from)) / DAY_MS)

/** Total del documento: SIEMPRE la suma de los totales de línea redondeados al centavo. */
export function sumLines(lines: readonly QuotationDocLine[]): number {
  return r2(lines.reduce((s, l) => s + r2(l.totalUsd), 0))
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#222;background:#fff}
.sheet{width:100%;border-collapse:collapse}
.sheet>tbody>tr>td,.sheet>tfoot>tr>td{padding:0}
.page{max-width:720px;margin:0 auto;padding:24px 20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #222;margin-bottom:18px}
.logo{display:block;max-height:64px;max-width:180px;margin-bottom:12px}
.biz{font-size:22px;font-weight:700;margin-bottom:3px}
.gray{font-size:11px;color:#555;line-height:1.45}
.doc-title{font-size:20px;font-weight:700;color:#444;text-align:right}
.num{font-size:11px;color:#555;text-align:right}
.validity{font-size:10px;color:#cc2200;text-align:right}
.client{margin-bottom:12px}
table.items{width:100%;border-collapse:collapse;margin:8px 0 0}
.items th{padding:7px 9px;text-align:left;border:1px solid #ccc;font-size:12px}
.items td{padding:7px 9px;border:1px solid #ccc;font-size:12px}
.items tr{break-inside:avoid}
.items thead{display:table-header-group}
.r{text-align:right}
.totals{margin:26px 0 0 auto;width:300px;border-top:2px solid #222;padding-top:14px;text-align:right;font-size:13px;font-weight:700}
.notes{margin-top:18px;padding:10px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px}
.spacer{height:18mm}
.foot{text-align:center;color:#777;font-size:8pt;line-height:1.5;padding:12px 20px 0}
@media screen{.spacer{display:none}.foot{max-width:720px;margin:0 auto;border-top:1px solid #ddd}}
@media print{@page{size:letter;margin:15mm}.page{padding:0;max-width:none}.foot{position:fixed;bottom:0;left:0;right:0;padding:0}}
`

function businessLines(b: QuotationDocBusiness): string[] {
  const rows: Array<[string, string]> = [
    ['RIF: ', clean(b.rif)], ['', clean(b.address)],
    ['Tel: ', clean(b.phone)], ['Correo: ', clean(b.email)],
  ]
  return rows.filter(([, v]) => v).map(([k, v]) => `<div class="gray">${k}${esc(v)}</div>`)
}

function lineLabel(l: QuotationDocLine): string {
  const pct = l.discountPct && l.discountPct > 0 ? ` (desc. ${trimDecimals(l.discountPct, 2)}%)` : ''
  return `${esc(l.description)}${pct}`
}

/** Pie: el configurado por el negocio o la vigencia; luego nombre · Tel. · dirección (vacíos fuera). */
function footerLines(doc: QuotationDocData, issuedYmd: string): string[] {
  const b = doc.business
  const days = doc.validUntilYmd ? daysBetweenYmd(issuedYmd, doc.validUntilYmd) : null
  const first = clean(b.footer)
    || (days !== null && days > 0
      ? `Esta cotización es válida por ${days} ${days === 1 ? 'día contado' : 'días contados'} desde su fecha de emisión.` : '')
  const second = [clean(b.name), clean(b.phone) ? `Tel. ${clean(b.phone)}` : '', clean(b.address)]
    .filter(Boolean).join(' · ')
  return [first, second].filter(Boolean).map(esc)
}

export function buildQuotationHtml(doc: QuotationDocData): string {
  const issuedYmd = businessDateKey(doc.issuedAt)
  const total = sumLines(doc.lines)
  if (doc.sourceTotalUsd != null && Math.abs(r2(doc.sourceTotalUsd) - total) > CENT_TOLERANCE) {
    logError('quotation-document', new Error(
      `total de la fuente ${r2(doc.sourceTotalUsd)} distinto de la suma de líneas ${total}; se imprime la suma`))
  }

  const rows = doc.lines.map(l => `<tr><td>${lineLabel(l)}</td><td class="r">${esc(fmtQty(l.qty, l.saleMode))}</td>`
    + `<td class="r">${fmtMoney(l.unitPriceUsd)}</td><td class="r">${fmtMoney(r2(l.totalUsd))}</td></tr>`).join('')

  const number = clean(doc.number)
  const body = [
    '<div class="hdr"><div>',
    clean(doc.business.logoUrl) ? `<img class="logo" src="${esc(clean(doc.business.logoUrl))}" alt="">` : '',
    `<div class="biz">${esc(clean(doc.business.name))}</div>`,
    ...businessLines(doc.business),
    `<div class="gray">${fmtYmd(issuedYmd)}</div>`,
    `<div class="gray">Atendido por: ${esc(clean(doc.attendedBy))}</div>`,
    '</div><div>',
    '<div class="doc-title">COTIZACI&Oacute;N</div>',
    `<div class="num">${number ? `N&deg; ${esc(number)}` : 'Borrador (sin n&uacute;mero)'}</div>`,
    doc.validUntilYmd ? `<div class="validity">V&aacute;lida hasta: ${fmtYmd(doc.validUntilYmd)}</div>` : '',
    '</div></div>',
    clean(doc.clientName) ? `<div class="client"><strong>Cliente:</strong> ${esc(clean(doc.clientName))}</div>` : '',
    '<table class="items"><thead><tr><th>Descripci&oacute;n</th><th class="r">Cant.</th>'
      + '<th class="r">P.Unit (USD)</th><th class="r">Total (USD)</th></tr></thead>'
      + `<tbody>${rows}</tbody></table>`,
    `<div class="totals">Total ${fmtMoney(total)}</div>`,
    clean(doc.notes) ? `<div class="notes"><strong>Observaciones:</strong> ${esc(clean(doc.notes))}</div>` : '',
  ].join('')

  const foot = footerLines(doc, issuedYmd).join('<br>')
  return [
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
    `<title>Cotizaci&oacute;n ${esc(number)}</title><style>${CSS}</style></head><body>`,
    `<table class="sheet"><tbody><tr><td><div class="page">${body}</div></td></tr></tbody>`,
    '<tfoot><tr><td><div class="spacer"></div></td></tr></tfoot></table>',
    foot ? `<div class="foot">${foot}</div>` : '',
    '</body></html>',
  ].join('')
}

export function openQuotationPrint(doc: QuotationDocData): void {
  openPrintDocument(buildQuotationHtml(doc))
}

/* ── Adaptadores: cada fuente arma el MISMO QuotationDocData ── */

interface DocContext {
  business: QuotationDocBusiness
  attendedBy: string
}

export function docFromTicket(
  ticket: Pick<TicketState, 'items' | 'client_name'>,
  totalUsd: number,
  opts: { validityDays: number; notes: string; number?: string | null },
  ctx: DocContext,
): QuotationDocData {
  const now = new Date()
  return {
    ...ctx,
    number: opts.number,
    issuedAt: now,
    validUntilYmd: shiftDateKey(businessDateKey(now), opts.validityDays),
    clientName: ticket.client_name,
    notes: opts.notes,
    sourceTotalUsd: totalUsd,
    lines: ticket.items.map(i => ({
      description: i.variant_label ? `${i.product_name} — ${i.variant_label}` : i.product_name,
      qty: i.quantity,
      saleMode: i.sale_mode === 'weight' ? 'weight' : 'unit',
      unitPriceUsd: i.price_per_unit_usd,
      discountPct: i.subtotal_usd > 0 ? r2((i.discount_usd / i.subtotal_usd) * 100) : 0,
      totalUsd: r2(i.subtotal_usd - i.discount_usd),
    })),
  }
}

export function docFromQuotation(q: QuotationDocSource, ctx: DocContext): QuotationDocData {
  return {
    ...ctx,
    number: q.number,
    issuedAt: q.created_at ? new Date(q.created_at) : new Date(),
    validUntilYmd: q.valid_until ? q.valid_until.slice(0, 10) : null,
    clientName: q.client?.name,
    notes: q.notes,
    sourceTotalUsd: q.total_usd,
    lines: q.items.map(i => ({
      description: i.name,
      qty: i.qty,
      saleMode: 'unit',
      unitPriceUsd: i.price_usd,
      discountPct: i.discount_pct ?? 0,
      totalUsd: r2(i.qty * i.price_usd * (1 - (i.discount_pct ?? 0) / 100)),
    })),
  }
}

/** Venta POS status 'quote': la vigencia NO se guarda en Sale, así que "Válida hasta" queda fuera. */
export function docFromSale(s: SaleDocSource, ctx: DocContext): QuotationDocData {
  return {
    ...ctx,
    attendedBy: s.cashier?.name ?? ctx.attendedBy,
    number: s.ticket_number,
    issuedAt: new Date(s.created_at),
    validUntilYmd: null,
    clientName: s.client?.name ?? s.client_name,
    notes: s.notes,
    sourceTotalUsd: Number(s.total_usd),
    // /api/sales serializa los Decimal de Prisma como texto: se normaliza acá, en la frontera.
    lines: s.items.map(i => {
      const subtotal = Number(i.subtotal_usd)
      const discount = Number(i.discount_usd)
      return {
        description: i.product_name,
        qty: Number(i.quantity),
        saleMode: i.unit_label === 'kg' ? 'weight' : 'unit',
        unitPriceUsd: Number(i.price_per_unit_usd),
        discountPct: subtotal > 0 ? r2((discount / subtotal) * 100) : 0,
        totalUsd: r2(subtotal - discount),
      }
    }),
  }
}
