import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminSidebar } from './AdminSidebar'
import { ForceDarkTheme } from './ForceDarkTheme'
import styles from './admin.module.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') redirect('/escritorio')

  return (
    <div className={styles.shell}>
      <ForceDarkTheme />
      <AdminSidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
