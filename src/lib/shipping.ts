// Datos de envío (encomienda nacional): validación única (servidor y cliente) y
// texto listo para pegar en el portal de la empresa. Sin dependencias de DB.

import { checkCedula } from './cedula'

export interface ShippingData {
  orderNumber: string
  businessName: string
  recipient:   string
  cedula:      string
  phone:       string
  address:     string
  notes:       string
  /** Suma de cantidades del pedido. */
  units:       number
  /** Lo escribe el operador al imprimir/copiar; no se guarda. Vacío = no se imprime. */
  bundles?:    string
}

export const SHIPPING_ADDRESS_LABEL = 'Estado, ciudad y dirección completa u oficina de destino'

const MIN_ADDRESS_CHARS = 15
const PLACEHOLDER_RE = /^sin\s+especificar$/i

/** Mensaje de error si la dirección de envío no sirve (muy corta o "sin especificar"), o null. */
export function validateAddress(address: string | null | undefined): string | null {
  const addr = (address ?? '').trim()
  if (addr.length < MIN_ADDRESS_CHARS || PLACEHOLDER_RE.test(addr)) {
    return `Para envíos indica: ${SHIPPING_ADDRESS_LABEL}.`
  }
  return null
}

/**
 * Avisos (NO bloqueos) de un envío: lo que falta para despacharlo. Nombre y teléfono ya los exige el checkout;
 * aquí solo cédula y destino. Con oficina escrita la dirección no hace falta. Lista vacía = envío completo.
 */
export function shippingIssues(d: {
  cedula:  string | null | undefined
  address: string | null | undefined
  branch?: string | null | undefined
}): string[] {
  const issues: string[] = []
  const ced = checkCedula(d.cedula, null, true)
  if (!ced.ok) issues.push('Falta una cédula válida del destinatario.')
  const hasBranch = (d.branch ?? '').trim().length >= 3
  if (!hasBranch && validateAddress(d.address) !== null) issues.push('Falta la oficina o la dirección de destino.')
  return issues
}

/** Bloque de texto en orden fijo, listo para pegar en el portal de la empresa de encomienda. */
export function shippingCopyText(d: ShippingData): string {
  return [
    `Nombre: ${d.recipient}`,
    `C.I.: ${d.cedula}`,
    `Tel: ${d.phone}`,
    `Dirección: ${d.address}`,
    `Orden: ${d.orderNumber}`,
    ...(d.notes.trim() ? [`Notas: ${d.notes.trim()}`] : []),
    `Unidades: ${d.units}`,
    ...((d.bundles ?? '').trim() ? [`Bultos: ${(d.bundles ?? '').trim()}`] : []),
  ].join('\n')
}
