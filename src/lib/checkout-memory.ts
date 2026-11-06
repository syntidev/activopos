// Memoria del checkout en ESTE dispositivo (localStorage, por negocio): nombre, cédula, teléfono, método de envío, oficina y ciudad/dirección
// del último pedido confirmado. Nunca sale del navegador. Todo va en try/catch: sin localStorage (modo privado, bloqueado) simplemente no hay memoria.

const PREFIX = 'activopos:checkout:'

export interface CheckoutMemory {
  name:         string
  cedula:       string
  phone:        string
  methodId:     number | null
  branchOffice: string
  address:      string
}

const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 300) : '')

export function loadCheckoutMemory(slug: string): CheckoutMemory | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + slug)
    if (!raw) return null
    const j = JSON.parse(raw) as Record<string, unknown>
    const name = str(j.name)
    const phone = str(j.phone)
    if (!name || !phone) return null
    return {
      name, phone,
      cedula:       str(j.cedula),
      methodId:     typeof j.methodId === 'number' && Number.isInteger(j.methodId) ? j.methodId : null,
      branchOffice: str(j.branchOffice),
      address:      str(j.address),
    }
  } catch {
    return null
  }
}

export function saveCheckoutMemory(slug: string, memory: CheckoutMemory): void {
  try { window.localStorage.setItem(PREFIX + slug, JSON.stringify(memory)) } catch { /* sin localStorage: no hay memoria */ }
}

/** "No soy yo": borra todo lo guardado de este negocio en este dispositivo. */
export function clearCheckoutMemory(slug: string): void {
  try { window.localStorage.removeItem(PREFIX + slug) } catch { /* nada que borrar */ }
}
