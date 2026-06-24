import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReportesClient } from './ReportesClient'

export const metadata = { title: 'Reportes — ActivoPOS' }

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login')
  const isAdmin = session.role === 'admin' || session.role === 'super_admin'
  return <ReportesClient isAdmin={isAdmin} />
}
