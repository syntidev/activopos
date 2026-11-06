/**
 * Mensaje de WhatsApp de la Carta (contrato de .doc/carta/TESTIDS.md): lo arma el cliente con lo que el servidor confirmó
 * (número de pedido) y lo que el comensal ve en su carrito. Puro y sin dependencias: lo usan la confirmación y el respaldo.
 */

export interface CartaWaLine {
  qty:         number
  name:        string
  /** Tamaño y opciones elegidas, ya en texto ("250 g, Pavo, Papas fritas"). */
  detail?:     string
  subtotalUsd: number
  note?:       string
}

export interface CartaWaInput {
  /** null = el registro del pedido falló y el mensaje se envía igual (respaldo): sin número. */
  orderNumber: string | null
  business:    string
  modalidad:   string
  client:      string
  phone:       string
  pago:        string
  lines:       CartaWaLine[]
  rate:        number
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
export const waUsd = (n: number): string => '$' + n.toFixed(2)
/** Sellado: Bs. 8,951.73 (coma de miles, punto decimal), determinista. */
export const waBs = (n: number): string => 'Bs. ' + round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function buildCartaMessage(a: CartaWaInput): string {
  const total = round2(a.lines.reduce((s, l) => s + l.subtotalUsd, 0))
  const lines = a.lines.flatMap(l => [
    l.qty + 'x ' + l.name + (l.detail ? ' (' + l.detail + ')' : '') + ' — ' + waUsd(l.subtotalUsd),
    ...(l.note ? ['   Nota: ' + l.note] : []),
  ])
  return [
    '*Pedido ' + (a.orderNumber ? a.orderNumber + ' · ' : '') + a.business + '*',
    'Modalidad: ' + a.modalidad,
    'Cliente: ' + a.client + ' · ' + a.phone,
    'Pago: ' + a.pago,
    '',
    ...lines,
    '',
    'Total: ' + waUsd(total) + ' · ' + waBs(total * a.rate),
  ].join('\n')
}
