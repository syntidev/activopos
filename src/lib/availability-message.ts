import { normalizePhone } from '@/lib/utils'

/** wa.me para preguntar cuándo vuelve un producto (o variante) agotado. '' si el negocio no tiene teléfono. */
export function availabilityWaUrl(phone: string, name: string, variantLabel: string | null, pageUrl: string): string {
  const digits = normalizePhone(phone)
  if (!digits) return ''
  const subject = variantLabel ? `${name} - ${variantLabel}` : name
  const text = `Hola, quiero saber cuándo vuelve a estar disponible: ${subject}. ${pageUrl}`.trim()
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
