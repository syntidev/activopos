'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, BarChart3, Receipt, Headset, Settings, LogOut, Zap } from 'lucide-react'
import styles from './admin.module.css'

const NAV = [
  { href: '/businesses',     icon: Building2, label: 'Negocios'      },
  { href: '/invoices',       icon: Receipt,   label: 'Facturas'      },
  { href: '/tickets',        icon: Headset,   label: 'Tickets'       },
  { href: '/stats',          icon: BarChart3, label: 'Estadísticas'  },
  { href: '/admin/settings', icon: Settings,  label: 'Config global' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [openTickets, setOpenTickets] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/tickets?status=open&count=true')
      .then(r => r.ok ? r.json() : null)
      .then((body: { ok: boolean; count?: number } | null) => {
        if (body?.count !== undefined) setOpenTickets(body.count)
      })
      .catch(() => {})
  }, [])

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
                  {href === '/tickets' && !!openTickets && (
                    <span className={styles.navBadge}>{openTickets > 9 ? '9+' : openTickets}</span>
                  )}
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
