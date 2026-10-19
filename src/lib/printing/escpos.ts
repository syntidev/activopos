// Ticket para impresora térmica en bytes ESC/POS.
//
// Función pura: sin DB, sin red, sin QZ. Dos pasos para que la vista previa del
// panel y lo que sale por la impresora sean LO MISMO:
//   1. layout*()  -> PrintLine[]  (qué se imprime y cómo se alinea)
//   2. encodeTicket() -> Uint8Array ESC/POS   |   renderPreview() -> texto plano
//
// Decisiones:
// - Ancho: 58mm = 32 columnas, 80mm = 48 (fuente A, monoespaciada).
// - Texto en CP858 (ESC t 19) para ñ/acentos/¿¡/€; CP850 (ESC t 2) como
//   alternativa configurable. Un carácter fuera de la página sale como "?".
// - Doble moneda con la misma lógica que la ruta HTML del ticket: show_bs /
//   show_foreign mandan, y si ambos vinieran apagados cae a divisas antes que
//   imprimir un ticket sin un solo monto.

import type { ThermalCodepage, ThermalPaper, ThermalTicketData } from '@/types/thermal'

export type PrintLine =
  | { kind: 'text'; text: string; bold?: boolean; align?: 'left' | 'center' }
  | { kind: 'logo' }
  | { kind: 'qr'; data: string }

/** Imagen monocroma ya rasterizada (GS v 0): 1 bit por punto, filas de ceil(width/8) bytes. */
export interface RasterImage {
  width:  number
  height: number
  bytes:  Uint8Array
}

export function colsForPaper(paper: ThermalPaper): number {
  return paper === '80mm' ? 48 : 32
}

/* ── Texto ─────────────────────────────────────────────────────────────── */

/** Normaliza tipografía "inteligente" que ninguna code page trae. */
export function sanitize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[×✕]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\r\t]/g, ' ')
}

/** Parte por palabras; una palabra más larga que la línea se corta a la fuerza. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word
      while (w.length > width) {
        if (line) { out.push(line); line = '' }
        out.push(w.slice(0, width))
        w = w.slice(width)
      }
      if (!line)                                    line = w
      else if (line.length + 1 + w.length <= width) line += ` ${w}`
      else { out.push(line); line = w }
    }
    if (line) out.push(line)
  }
  return out
}

/** `izq ........ der` a todo el ancho; si no caben, recorta la izquierda. */
export function row(left: string, right: string, cols: number): string {
  const space = cols - left.length - right.length
  if (space >= 1) return left + ' '.repeat(space) + right
  return `${left.slice(0, Math.max(0, cols - right.length - 1))} ${right}`
}

const fmt2 = (n: number): string => n.toFixed(2)

/** Mismo formato sellado del proyecto: "Bs. 8,951.73". */
const fmtBs = (n: number): string =>
  `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtQty = (n: number): string => String(Number(n.toFixed(3)))

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ── Layout ────────────────────────────────────────────────────────────── */

const txt = (text: string, bold = false, align: 'left' | 'center' = 'left'): PrintLine =>
  ({ kind: 'text', text, bold, align })

export interface SaleLayoutOptions {
  /** URL absoluta del catálogo; con show_catalog_qr se imprime como QR. */
  catalogUrl?: string | null
}

export function layoutSaleTicket(
  t: ThermalTicketData, paper: ThermalPaper, opts: SaleLayoutOptions = {},
): PrintLine[] {
  const cols = colsForPaper(paper)
  const { business: b, flags: f, sale: s, print: p } = t

  const showBs      = f.show_bs
  const showForeign = f.show_foreign || !showBs
  const isRef       = f.foreign_format === 'ref'
  const foreign     = (n: number): string => (isRef ? `REF ${fmt2(n)}` : `$${fmt2(n)}`)
  const hr          = '-'.repeat(cols)

  const L: PrintLine[] = []

  if (p.show_logo && b.logo_url) L.push({ kind: 'logo' })
  for (const line of wrap(sanitize(b.name).toUpperCase(), cols)) L.push(txt(line, true, 'center'))
  if (p.header.trim()) for (const line of wrap(sanitize(p.header), cols)) L.push(txt(line, false, 'center'))
  if (f.show_rif && b.rif) L.push(txt(sanitize(`RIF: ${b.rif}`), false, 'center'))
  if (f.show_address && b.address) {
    for (const line of wrap(sanitize(b.address), cols)) L.push(txt(line, false, 'center'))
  }
  if (f.show_phone && b.phone) L.push(txt(sanitize(`Tel: ${b.phone}`), false, 'center'))
  L.push(txt(hr))

  L.push(txt(`Ticket: ${sanitize(s.ticket_number)}`))
  L.push(txt(`Fecha: ${fmtDate(s.sold_at)}`))
  if (f.show_cashier_name) for (const l of wrap(sanitize(`Cajero: ${s.cashier_name}`), cols)) L.push(txt(l))

  if (f.show_customer_data && (s.client_name || s.client_phone)) {
    if (s.client_name)  for (const l of wrap(sanitize(`Cliente: ${s.client_name}`), cols)) L.push(txt(l))
    if (s.client_phone) for (const l of wrap(sanitize(`Tel. cliente: ${s.client_phone}`), cols)) L.push(txt(l))
  }
  L.push(txt(hr))

  for (const item of s.items) {
    const label = item.variant_label ? `${item.name} (${item.variant_label})` : item.name
    for (const l of wrap(sanitize(label), cols)) L.push(txt(l))
    if (f.show_description && item.description) {
      for (const l of wrap(sanitize(item.description).slice(0, 60), cols - 2)) L.push(txt(`  ${l}`))
    }
    // Monto por línea: sigue al mismo interruptor que los totales -- si el
    // negocio apagó divisas, el ítem sale en Bs, no desaparece.
    const unit = showForeign
      ? foreign(item.price_per_unit_usd)
      : fmtBs(item.quantity > 0 ? item.subtotal_bs / item.quantity : item.subtotal_bs)
    const amount = showForeign ? foreign(item.subtotal_usd) : fmtBs(item.subtotal_bs)
    L.push(txt(row(`  ${fmtQty(item.quantity)} x ${unit}`, amount, cols)))
    if (item.discount_usd > 0) {
      const disc = showForeign ? foreign(item.discount_usd) : fmtBs(item.discount_usd * s.rate)
      L.push(txt(row('  Desc.:', `-${disc}`, cols)))
    }
  }
  L.push(txt(hr))

  if (showForeign) L.push(txt(row(`TOTAL ${isRef ? 'REF' : 'USD'}:`, foreign(s.total_usd), cols), true))
  if (showBs)      L.push(txt(row('TOTAL Bs:', fmtBs(s.total_bs), cols), true))
  if (f.show_bcv_rate) L.push(txt(row('Tasa BCV:', s.rate.toFixed(4), cols)))

  if (f.show_payment_method && s.payments.length > 0) {
    L.push(txt(hr))
    for (const pay of s.payments) {
      const amount = showForeign ? foreign(pay.amount_usd) : fmtBs(pay.amount_usd * s.rate)
      L.push(txt(row(sanitize(`Metodo: ${pay.method}`), amount, cols)))
    }
  }
  L.push(txt(hr))

  if (b.footer) for (const l of wrap(sanitize(b.footer), cols)) L.push(txt(l, false, 'center'))
  if (p.show_catalog_qr && opts.catalogUrl) {
    L.push(txt('Nuestro catalogo:', false, 'center'))
    L.push({ kind: 'qr', data: opts.catalogUrl })
  }
  L.push(txt('Gracias por su compra!', false, 'center'))

  return L
}

export interface TestTicketInfo {
  businessName: string
  printer:      string
  qzVersion:    string
  paper:        ThermalPaper
  codepage:     ThermalCodepage
  now:          Date
}

/** Ticket de diagnóstico: todo lo que soporte necesita ver en una sola foto. */
export function layoutTestTicket(i: TestTicketInfo): PrintLine[] {
  const cols  = colsForPaper(i.paper)
  const ruler = '1234567890'.repeat(Math.ceil(cols / 10)).slice(0, cols)
  const L: PrintLine[] = []

  for (const line of wrap(sanitize(i.businessName || 'ActivoPOS').toUpperCase(), cols)) L.push(txt(line, true, 'center'))
  L.push(txt('-'.repeat(cols)))
  L.push(txt('PRUEBA DE IMPRESION', true, 'center'))
  L.push(txt(fmtDate(i.now.toISOString()), false, 'center'))
  L.push(txt('-'.repeat(cols)))
  for (const l of wrap(`Impresora: ${sanitize(i.printer)}`, cols)) L.push(txt(l))
  L.push(txt(`QZ Tray: v${i.qzVersion}`))
  L.push(txt(`Ancho: ${i.paper} (${cols} columnas)`))
  L.push(txt(`Codigo: ${i.codepage.toUpperCase()}`))
  L.push(txt(ruler))
  L.push(txt('ñ Ñ á é í ó ú ü ¿ ¡'))
  L.push(txt('Si ves la regla completa y los'))
  L.push(txt('acentos bien, todo esta listo.'))
  return L
}

/** Etiqueta de envío: SOLO nombre, cédula, teléfono y dirección. Sin orden, precios ni totales. */
export interface ShippingLabelInfo {
  recipient: string
  cedula:    string
  phone:     string
  address:   string
}

export function layoutShippingLabel(i: ShippingLabelInfo, paper: ThermalPaper): PrintLine[] {
  const cols = colsForPaper(paper)
  const L: PrintLine[] = []
  const field = (label: string, value: string): void => {
    for (const l of wrap(`${label} ${sanitize(value)}`, cols)) L.push(txt(l))
  }

  field('Nombre:', i.recipient)
  field('C.I.:', i.cedula)
  field('Tel:', i.phone)
  L.push(txt('Direccion:'))
  for (const part of i.address.split(String.fromCharCode(10))) {
    for (const l of wrap(sanitize(part), cols)) L.push(txt(l))
  }
  return L
}

/** Vista previa en texto plano, al ancho real del papel. */
export function renderPreview(lines: PrintLine[], paper: ThermalPaper): string {
  const cols = colsForPaper(paper)
  const centered = (s: string): string => ' '.repeat(Math.max(0, Math.floor((cols - s.length) / 2))) + s
  return lines.map(l => {
    if (l.kind === 'logo') return centered('[ LOGO ]')
    if (l.kind === 'qr')   return centered('[ QR catalogo ]')
    return l.align === 'center' ? centered(l.text) : l.text
  }).join('\n')
}

/* ── Bytes ESC/POS ─────────────────────────────────────────────────────── */

const ESC = 0x1B
const GS  = 0x1D
const LF  = 0x0A

/** Posiciones de la code page (mitad alta) para los caracteres que importan en español. */
const CP850_HIGH: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89,
  'è': 0x8A, 'ï': 0x8B, 'î': 0x8C, 'ì': 0x8D, 'Ä': 0x8E, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95,
  'û': 0x96, 'ù': 0x97, 'Ö': 0x99, 'Ü': 0x9A, '¢': 0x9B, '£': 0x9C, 'á': 0xA0, 'í': 0xA1, 'ó': 0xA2,
  'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5, 'ª': 0xA6, 'º': 0xA7, '¿': 0xA8, '¡': 0xAD, 'Á': 0xB5, 'Â': 0xB6,
  'À': 0xB7, 'Í': 0xD6, 'Î': 0xD7, 'Ó': 0xE0, 'Ô': 0xE2, 'Ú': 0xE9, '°': 0xF8,
}
const CP858_HIGH: Record<string, number> = { ...CP850_HIGH, '€': 0xD5 }

const CODEPAGES: Record<ThermalCodepage, { escT: number; map: Record<string, number> }> = {
  cp858: { escT: 19, map: CP858_HIGH },
  cp850: { escT: 2,  map: CP850_HIGH },
}

export function encodeText(text: string, codepage: ThermalCodepage): number[] {
  const { map } = CODEPAGES[codepage]
  const out: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0x3F
    if (code >= 0x20 && code <= 0x7E) out.push(code)
    else out.push(map[ch] ?? 0x3F)   // '?'
  }
  return out
}

/** GS ( k: QR nativo (modelo 2, módulo 6, corrección M). */
function qrBytes(data: string): number[] {
  const body = encodeText(data, 'cp850').slice(0, 200)
  const len  = body.length + 3
  return [
    GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,              // modelo 2
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06,                    // tamaño de módulo
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31,                    // corrección M
    GS, 0x28, 0x6B, len & 0xFF, len >> 8, 0x31, 0x50, 0x30, ...body, // datos
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30,                    // imprimir
  ]
}

/** GS v 0: imagen raster. */
function rasterBytes(img: RasterImage): number[] {
  const wBytes = Math.ceil(img.width / 8)
  return [
    GS, 0x76, 0x30, 0x00, wBytes & 0xFF, wBytes >> 8, img.height & 0xFF, img.height >> 8,
    ...Array.from(img.bytes),
  ]
}

export interface EncodeOptions {
  codepage:   ThermalCodepage
  openDrawer: boolean
  logo?:      RasterImage | null
}

export function encodeTicket(lines: PrintLine[], o: EncodeOptions): Uint8Array {
  const b: number[] = [ESC, 0x40, ESC, 0x74, CODEPAGES[o.codepage].escT]   // ESC @ ; ESC t n

  for (const l of lines) {
    if (l.kind === 'logo') {
      if (o.logo) b.push(ESC, 0x61, 0x01, ...rasterBytes(o.logo), LF, ESC, 0x61, 0x00)
      continue
    }
    if (l.kind === 'qr') {
      b.push(ESC, 0x61, 0x01, ...qrBytes(l.data), LF, ESC, 0x61, 0x00)
      continue
    }
    b.push(ESC, 0x61, l.align === 'center' ? 0x01 : 0x00)
    if (l.bold) b.push(ESC, 0x45, 0x01)
    b.push(...encodeText(l.text, o.codepage))
    if (l.bold) b.push(ESC, 0x45, 0x00)
    b.push(LF)
  }

  b.push(ESC, 0x61, 0x00, ESC, 0x64, 0x04)                  // avanza 4 líneas: pasa la barra de corte
  if (o.openDrawer) b.push(ESC, 0x70, 0x00, 0x19, 0xFA)     // ESC p: pulso de cajón
  b.push(GS, 0x56, 0x42, 0x00)                              // GS V 66 0: corte parcial
  return Uint8Array.from(b)
}

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
