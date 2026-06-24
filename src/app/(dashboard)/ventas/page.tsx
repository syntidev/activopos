import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { VentasPage } from './VentasPage'

export const metadata = { title: 'Historial de Ventas — ActivoPOS' }

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login')
  const isAdmin = session.role === 'admin' || session.role === 'super_admin'
  return <VentasPage isAdmin={isAdmin} />
}
