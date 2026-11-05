/**
 * Notas del pedido de la Carta (C1): POST /api/catalog/[slug]/order solo admite un campo "notes" (máx. 500) y el servidor lo
 * agrega al WhatsApp. Aquí se concatenan la modalidad y la nota de cada plato. La nota por línea real llega en C2 (migración).
 */
export const ORDER_NOTES_MAX = 500

export type Modalidad = 'sitio' | 'llevar' | 'delivery'

export const MODALIDAD_LABEL: Record<Modalidad, string> = { sitio: 'En sitio', llevar: 'Para llevar', delivery: 'Delivery' }

export interface NoteLine {
  name: string
  /** Etiqueta del tamaño, si el plato lo tiene. */
  size?: string
  qty:  number
  note?: string
}

export interface OrderNotes {
  text:      string
  /** true si hubo que recortar para caber en 500 caracteres (la interfaz lo avisa). */
  truncated: boolean
}

/** "En sitio · Mesa 4" / "Para llevar" / "Delivery". */
export function modalidadLabel(modalidad: Modalidad, mesa: string): string {
  const m = mesa.trim()
  return MODALIDAD_LABEL[modalidad] + (modalidad === 'sitio' && m ? ' · Mesa ' + m : '')
}

export function buildOrderNotes(modalidad: Modalidad, mesa: string, lines: readonly NoteLine[]): OrderNotes {
  const parts = ['Modalidad: ' + modalidadLabel(modalidad, mesa)]
  const withNote = lines.filter(l => l.note && l.note.trim())
  if (withNote.length > 0) {
    parts.push('Notas por plato:')
    for (const l of withNote) {
      parts.push('- ' + l.name + (l.size ? ' (' + l.size + ')' : '') + ' x' + l.qty + ': ' + (l.note ?? '').trim().replace(/\s+/g, ' '))
    }
  }
  const full = parts.join('\n')
  if (full.length <= ORDER_NOTES_MAX) return { text: full, truncated: false }
  return { text: full.slice(0, ORDER_NOTES_MAX - 1) + '…', truncated: true }
}
