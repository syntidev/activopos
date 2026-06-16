import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ConfiguracionView } from './ConfiguracionView'

export const metadata = {
  title: 'Configuración — ActivoPOS',
}

export default async function ConfiguracionPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.role === 'cashier') {
    redirect('/escritorio')
  }

  return <ConfiguracionView session={session} />
}
