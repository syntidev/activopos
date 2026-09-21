import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isImpersonating } from '@/lib/impersonation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { OperadorShell } from '@/components/layout/OperadorShell'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { RateProvider } from '@/context/RateContext'
import { CajaProvider } from '@/context/CajaContext'
import { UnsavedChangesProvider } from '@/context/UnsavedChangesContext'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Rol restringido: shell mínimo, sin providers de caja/tasa ni sidebar del negocio.
  if (session.role === 'operador_reservas') {
    return <OperadorShell session={session}>{children}</OperadorShell>
  }

  const impersonating = await isImpersonating()

  return (
    <>
      <ImpersonationBanner />
      <RateProvider>
        <CajaProvider>
          <UnsavedChangesProvider>
            <DashboardShell session={session} isImpersonating={impersonating}>{children}</DashboardShell>
          </UnsavedChangesProvider>
        </CajaProvider>
      </RateProvider>
    </>
  )
}
