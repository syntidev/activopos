import { headers } from 'next/headers'

/**
 * Origen ABSOLUTO del sitio para las etiquetas Open Graph. Sin esto Next resuelve las rutas relativas contra `http://localhost:<puerto>`
 * (el puerto interno del proceso) y WhatsApp/Facebook no pueden descargar la imagen: la vista previa sale sin foto.
 *
 * Orden: host de la petición (x-forwarded-host que pone el proxy, o host) con su protocolo; si ese host es interno/loopback o inválido
 * en producción, NEXT_PUBLIC_APP_URL y, al final, https://activopos.com. El host se valida (no se refleja cualquier cabecera).
 */
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/
const LOOPBACK_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.)/

const stripSlash = (u: string): string => u.replace(/\/+$/, '')

export function siteOrigin(): string {
  const h = headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim().toLowerCase()
  const proto = (h.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase()
  const valid = HOST_RE.test(host)
  const internal = !valid || LOOPBACK_RE.test(host)

  if (internal && process.env.NODE_ENV === 'production') return stripSlash(process.env.NEXT_PUBLIC_APP_URL ?? 'https://activopos.com')
  if (!valid) return 'http://localhost:3000'
  const scheme = proto === 'https' || proto === 'http' ? proto : internal ? 'http' : 'https'
  return `${scheme}://${host}`
}
