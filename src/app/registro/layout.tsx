import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Regístrate — ActivoPOS',
  description: 'Crea tu cuenta y empieza a controlar tu negocio hoy.',
}

export default async function RegistroLayout({ children }: { children: React.ReactNode }) {
  // Este layout de servidor SOLO corre en la carga inicial de /registro. Un usuario ya
  // logueado que llega acá (link viejo) se manda al dashboard -> no queda atrapado en el
  // wizard. Importante: la sesión que crea el propio wizard (paso 6, client-side) NO
  // re-renderiza este layout, así que el paso 7 "Ir al dashboard" sigue funcionando.
  const session = await getSession()
  if (session) redirect(session.role === 'super_admin' ? '/businesses' : '/escritorio')

  return children
}
