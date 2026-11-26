import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAuthenticatedTenant } from '@/lib/tenant'
import { ReportesView } from './ReportesView'

export const metadata: Metadata = { title: 'Reportes del restaurante' }
export const dynamic = 'force-dynamic'

/** Reportes del restaurante: solo admin. El flag y el derecho los valida restaurante/layout.tsx; los datos salen de la sesión (tenant). */
export default async function ReportesPage() {
  const { session } = await getAuthenticatedTenant()
  if (session.role !== 'admin' && session.role !== 'super_admin') notFound()
  return <ReportesView />
}
