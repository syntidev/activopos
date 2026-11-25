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
  const isAdmin = session.role === 'admin' || session.role === 'super_admin'
  const canPickWaiter = session.role !== 'waiter'

  // Quién puede atender mesas, para que admin y cajero escojan mesonero al abrir una cuenta (el mesonero abre a su nombre).
  const waiters = canPickWaiter
    ? await db.user.findMany({
        where: { is_active: true, role: { in: ['waiter', 'cashier', 'admin'] } },
        select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 100,
      })
    : []
  return (
    <SalonView
      initial={await loadSalon(db)} isAdmin={isAdmin} waiters={waiters}
      currentUserId={session.userId} canPickWaiter={canPickWaiter}
    />
  )
}
