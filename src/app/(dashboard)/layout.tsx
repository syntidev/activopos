import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/DashboardShell'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return <DashboardShell session={session}>{children}</DashboardShell>
}
