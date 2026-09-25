// Plantilla de ticket para impresora térmica (ESC/POS en texto plano).
//
// Función pura: sin DB, sin red, sin QZ. Recibe los datos ya resueltos por el
// servidor (/api/sales/[id]/ticket-data) y devuelve el string que QZ Tray manda
// a la impresora como comando crudo.
//
// Decisiones (todas verificables con scripts/check-thermal-ticket.mjs):
// - Ancho: 58mm = 32 columnas, 80mm = 48 (fuente A, monoespaciada).
// - SOLO ASCII. Cada impresora térmica trae su propia code page (437, 850,
//   1252...) y una equivocada imprime basura en lugar de acentos. Hasta probar
//   con la impresora real, "Niños" sale "Ninos": ilegible nunca, feo a veces.
// - Doble moneda con la misma lógica que la ruta HTML del ticket: los flags
//   ticket_show_bs / ticket_show_foreign mandan, y si ambos vinieran apagados
//   cae a divisas antes que imprimir un ticket sin un solo monto.
// - Centrado a mano (espacios) y no con ESC a: una secuencia menos que puede
//   comportarse distinto entre clones baratos.

import type { ThermalPaper, ThermalTicketData } from '@/types/thermal'

const ESC = '\x1B'
const GS  = '\x1D'

const INIT     = `${ESC}@`
const BOLD_ON  = `${ESC}E\x01`
const BOLD_OFF = `${ESC}E\x00`
const FEED_4   = `${ESC}d\x04`      // imprime y avanza 4 líneas: pasa la barra de corte
const CUT      = `${GS}V\x42\x00`   // corte parcial; una impresora sin cortadora lo ignora

export function colsForPaper(paper: ThermalPaper): number {
  return paper === '80mm' ? 48 : 32
}

/** Solo ASCII imprimible: sin acentos ni símbolos que dependan de code page. */
export function toPrinterText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[×✕]/g, 'x')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '')
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
      if (!line)                                  line = w
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

const center = (text: string, cols: number): string =>
  ' '.repeat(Math.max(0, Math.floor((cols - text.length) / 2))) + text

const bold = (line: string): string => `${BOLD_ON}${line}${BOLD_OFF}`

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

const assemble = (lines: string[]): string => `${INIT}${lines.join('\n')}\n${FEED_4}${CUT}`

export function buildThermalTicket(t: ThermalTicketData, paper: ThermalPaper): string {
  const cols = colsForPaper(paper)
  const { business: b, flags: f, sale: s } = t

  const showBs      = f.show_bs
  const showForeign = f.show_foreign || !showBs
  const isRef       = f.foreign_format === 'ref'
  const foreign     = (n: number): string => (isRef ? `REF ${fmt2(n)}` : `$${fmt2(n)}`)
  const hr          = '-'.repeat(cols)

  const L: string[] = []

  for (const line of wrap(toPrinterText(b.name).toUpperCase(), cols)) L.push(bold(center(line, cols)))
  if (f.show_rif && b.rif) L.push(center(toPrinterText(`RIF: ${b.rif}`), cols))
  if (f.show_address && b.address) {
    for (const line of wrap(toPrinterText(b.address), cols)) L.push(center(line, cols))
  }
  if (f.show_phone && b.phone) L.push(center(toPrinterText(`Tel: ${b.phone}`), cols))
  L.push(hr)

  L.push(`Ticket: ${toPrinterText(s.ticket_number)}`)
  L.push(`Fecha: ${fmtDate(s.sold_at)}`)
  if (f.show_cashier_name) L.push(...wrap(toPrinterText(`Cajero: ${s.cashier_name}`), cols))

  if (f.show_customer_data && (s.client_name || s.client_phone)) {
    if (s.client_name)  L.push(...wrap(toPrinterText(`Cliente: ${s.client_name}`), cols))
    if (s.client_phone) L.push(...wrap(toPrinterText(`Tel. cliente: ${s.client_phone}`), cols))
  }
  L.push(hr)

  for (const item of s.items) {
    const label = item.variant_label ? `${item.name} (${item.variant_label})` : item.name
    L.push(...wrap(toPrinterText(label), cols))
    if (f.show_description && item.description) {
      for (const line of wrap(toPrinterText(item.description).slice(0, 60), cols - 2)) L.push(`  ${line}`)
    }
    // Monto por línea: sigue al mismo interruptor que los totales -- si el
    // negocio apagó divisas, el ítem sale en Bs, no desaparece.
    const unit = showForeign
      ? foreign(item.price_per_unit_usd)
      : fmtBs(item.quantity > 0 ? item.subtotal_bs / item.quantity : item.subtotal_bs)
    const amount = showForeign ? foreign(item.subtotal_usd) : fmtBs(item.subtotal_bs)
    L.push(row(`  ${fmtQty(item.quantity)} x ${unit}`, amount, cols))
    if (item.discount_usd > 0) {
      const disc = showForeign ? foreign(item.discount_usd) : fmtBs(item.discount_usd * s.rate)
      L.push(row('  Desc.:', `-${disc}`, cols))
    }
  }
  L.push(hr)

  if (showForeign) L.push(bold(row(`TOTAL ${isRef ? 'REF' : 'USD'}:`, foreign(s.total_usd), cols)))
  if (showBs)      L.push(bold(row('TOTAL Bs:', fmtBs(s.total_bs), cols)))
  if (f.show_bcv_rate) L.push(row('Tasa BCV:', s.rate.toFixed(4), cols))

  if (f.show_payment_method && s.payments.length > 0) {
    L.push(hr)
    for (const p of s.payments) {
      const amount = showForeign ? foreign(p.amount_usd) : fmtBs(p.amount_usd * s.rate)
      L.push(row(toPrinterText(`Metodo: ${p.method}`), amount, cols))
    }
  }
  L.push(hr)

  if (b.footer) {
    for (const line of wrap(toPrinterText(b.footer), cols)) L.push(center(line, cols))
  }
  L.push(center('Gracias por su compra!', cols))

  return assemble(L)
}

/** Ticket de prueba: nombre, fecha, "PRUEBA DE IMPRESION" y una regla del ancho. */
export function buildTestTicket(businessName: string, paper: ThermalPaper, now: Date): string {
  const cols = colsForPaper(paper)
  const ruler = '1234567890'.repeat(Math.ceil(cols / 10)).slice(0, cols)
  const L: string[] = []

  for (const line of wrap(toPrinterText(businessName || 'ActivoPOS').toUpperCase(), cols)) {
    L.push(bold(center(line, cols)))
  }
  L.push('-'.repeat(cols))
  L.push(bold(center('PRUEBA DE IMPRESION', cols)))
  L.push(center(fmtDate(now.toISOString()), cols))
  L.push('-'.repeat(cols))
  L.push(`Papel: ${paper} (${cols} columnas)`)
  L.push(ruler)
  L.push('Si ves la regla completa sin')
  L.push('cortar, la impresora esta lista.')

  return assemble(L)
}
