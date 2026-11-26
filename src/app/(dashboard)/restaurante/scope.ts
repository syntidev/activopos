import { notFound } from 'next/navigation'
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import { getSession, type SessionPayload } from '@/lib/auth'
import { canUseRestaurante, loadEntitlementSource } from '@/lib/entitlements'

/**
 * Pieza común de las páginas del módulo Restaurante (plano y configuración):
 * las dos tipografías del módulo (dirección "el color es atención") y la puerta
 * de servidor. Los tokens viven en tokens.css bajo [data-restaurante].
 */

const ui = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-rs-ui', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-rs-mono', display: 'swap' })

/** Clases que cargan ambas fuentes; van en el mismo elemento que data-restaurante. */
export const rsFontClasses = `${ui.variable} ${mono.variable}`

/** Sin el flag del negocio o sin el derecho del plan, la ruta no existe (404). Esconder el link no basta: alguien puede escribir la URL. */
export async function gateRestaurante(): Promise<SessionPayload> {
  const session = await getSession()
  const business = session ? await loadEntitlementSource(session.businessId) : null
  if (!session || !business || !canUseRestaurante(business)) notFound()
  return session
}
