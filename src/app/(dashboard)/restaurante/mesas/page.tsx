import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAuthenticatedTenant } from '@/lib/tenant'
import { loadSalon } from '@/lib/restaurante-server'
import { SalonView } from './SalonView'

export const metadata: Metadata = { title: 'Salón' }
export const dynamic = 'force-dynamic'

/** Plano del salón. El flag lo valida restaurante/layout.tsx; los datos salen de la sesión (tenant). */
export default async function MesasPage() {
  const { session, db } = await getAuthenticatedTenant()
  if (session.role === 'kitchen') notFound()
  const snapshot = await loadSalon(db)
  return <SalonView initial={snapshot} isAdmin={session.role === 'admin' || session.role === 'super_admin'} />
}
