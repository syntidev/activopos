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
    <div id="dashboard-root" data-theme={dbTheme} suppressHydrationWarning>
      {/* Applies client theme preference before first paint — scoped to dashboard only */}
      <script dangerouslySetInnerHTML={{
        __html: `(function(){var ls=localStorage.getItem('activopos_theme');var t=(ls==='dark'||ls==='light')?ls:'${dbTheme}';var el=document.getElementById('dashboard-root');if(el)el.setAttribute('data-theme',t);})()`,
      }} />
      <DashboardShell session={session}>{children}</DashboardShell>
    </div>
  )
}
