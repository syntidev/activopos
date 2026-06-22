'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, BarChart3, Settings, LogOut, Zap } from 'lucide-react'
import styles from './admin.module.css'

const NAV = [
  { href: '/admin/businesses', icon: Building2, label: 'Negocios'    },
  { href: '/admin/stats',      icon: BarChart3,  label: 'Estadísticas' },
  { href: '/admin/settings',   icon: Settings,   label: 'Config global' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <Zap size={18} strokeWidth={2} aria-hidden="true" className={styles.logoIcon} />
        <span className={styles.logoText}>
          Activo<strong>ADMIN</strong>
        </span>
      </div>

      <div className={styles.divider} />

      <nav className={styles.nav} aria-label="Navegación admin">
        <ul role="list">
          {NAV.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className={styles.logoutBtn} aria-label="Cerrar sesión">
            <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
