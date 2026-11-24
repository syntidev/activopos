import type { Metadata } from 'next'
import { getAuthenticatedTenant } from '@/lib/tenant'
import { loadSalon } from '@/lib/restaurante-server'
import { ConfigRestaurante } from './ConfigRestaurante'

export const metadata: Metadata = { title: 'Configuración · Restaurante' }
export const dynamic = 'force-dynamic'

/** Áreas y mesas del módulo Restaurante. El flag lo valida el layout; el middleware limita /configuracion a admin. */
export default async function ConfigRestaurantePage() {
  const { db } = await getAuthenticatedTenant()
  return <ConfigRestaurante initial={await loadSalon(db)} />
}
