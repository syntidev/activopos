// Datos de envío (encomienda nacional): validación única (servidor y cliente) y
// texto listo para pegar en el portal de la empresa. Sin dependencias de DB.

import { checkCedula } from './cedula'
import { isValidWaPhone } from './whatsapp-message'

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

/** Mensaje de error si faltan datos obligatorios para un envío, o null si está completo. */
export function validateShipping(d: {
  recipient: string | null | undefined
  cedula:    string | null | undefined
  phone:     string | null | undefined
  address:   string | null | undefined
}): string | null {
  const name = (d.recipient ?? '').trim()
  if (name.split(/\s+/).filter(Boolean).length < 2) return 'Para envíos indica nombre y apellido del destinatario.'
  const ced = checkCedula(d.cedula, null, true)
  if (!ced.ok) return ced.message
  if (!isValidWaPhone(d.phone)) return 'Para envíos indica un teléfono válido del destinatario.'
  const addr = (d.address ?? '').trim()
  if (addr.length < MIN_ADDRESS_CHARS || PLACEHOLDER_RE.test(addr)) {
    return `Para envíos indica: ${SHIPPING_ADDRESS_LABEL}.`
  }
  return null
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
