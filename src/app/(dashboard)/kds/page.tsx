import { getSession } from '@/lib/auth'
import { canUseRestaurante, loadEntitlementSource } from '@/lib/entitlements'
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import KdsLegacy from './KdsLegacy'
import { EstacionKds } from './EstacionKds'

const ui = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-rs-ui', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-rs-mono', display: 'swap' })

/**
 * /kds: con el módulo Restaurante, el KDS por estación (la cocina siempre; el admin también, con enlace a los pedidos normales
 * en ?vista=pedidos). Sin el módulo, el KDS de siempre, intacto.
 */
export default async function KdsPage({ searchParams }: { searchParams: { vista?: string } }) {
  const session = await getSession()
  const business = session ? await loadEntitlementSource(session.businessId) : null
  const restaurante = session !== null && business !== null && canUseRestaurante(business)
  const porEstacion = restaurante && (session.role === 'kitchen' || searchParams.vista !== 'pedidos')
  if (!porEstacion) return <KdsLegacy />
  return (
    <div data-restaurante="" className={`${ui.variable} ${mono.variable}`}>
      <EstacionKds isAdmin={session.role !== 'kitchen'} />
    </div>
  )
}
