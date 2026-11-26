import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth'
import { canUse, loadEntitlementSource } from '@/lib/entitlements'

/**
 * Puerta del lado servidor de /kds (Planes v2): sin derecho al KDS (plan Operación o add-on Cocina), con la suscripción vencida o
 * suspendida, o con el módulo apagado en Configuración > Módulos, la pantalla no existe (404). Esconder el link del sidebar no basta:
 * alguien podría escribir la URL a mano. La API (/api/kds/*, /api/orders?send_to_kds=true) repite el chequeo con 403.
 */
export default async function KdsLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const business = session ? await loadEntitlementSource(session.businessId) : null

  if (!business || !canUse(business, 'kds')) notFound()

  return <>{children}</>
}
