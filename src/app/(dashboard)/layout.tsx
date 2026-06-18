import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/layout/DashboardShell'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { theme: true },
  })
  const dbTheme = business?.theme === 'light' ? 'light' : 'dark'

  return (
    <>
      {/* Runs before first paint — prevents theme flash */}
      <script dangerouslySetInnerHTML={{
        __html: `(function(){var ls=localStorage.getItem('activopos_theme');var t=(ls==='dark'||ls==='light')?ls:'${dbTheme}';document.documentElement.setAttribute('data-theme',t);})()`,
      }} />
      <DashboardShell session={session}>{children}</DashboardShell>
    </>
  )
}
