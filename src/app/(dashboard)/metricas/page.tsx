import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { MetricasClient } from './MetricasClient'

export const dynamic = 'force-dynamic'

export default async function MetricasPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Mismo permiso que Reportes: solo admin / super_admin.
  if (session.role !== 'admin' && session.role !== 'super_admin') redirect('/escritorio')
  return <MetricasClient />
}
