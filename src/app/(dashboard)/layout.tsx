import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isImpersonating } from '@/lib/impersonation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { RateProvider } from '@/context/RateContext'
import { CajaProvider } from '@/context/CajaContext'
import { UnsavedChangesProvider } from '@/context/UnsavedChangesContext'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

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
