'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, BarChart3, Receipt, Headset, Settings, LogOut, Zap, FileText, Menu } from 'lucide-react'
import styles from './admin.module.css'

const NAV = [
  { href: '/businesses',     icon: Building2, label: 'Negocios'      },
  { href: '/blog-admin',     icon: FileText,  label: 'Blog'          },
  { href: '/invoices',       icon: Receipt,   label: 'Facturas'      },
  { href: '/tickets',        icon: Headset,   label: 'Tickets'       },
  { href: '/stats',          icon: BarChart3, label: 'Estadísticas'  },
  { href: '/settings',       icon: Settings,  label: 'Config global' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openTickets, setOpenTickets] = useState<number | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }, [router])

  useEffect(() => {
    fetch('/api/admin/tickets?status=open&count=true')
      .then(r => r.ok ? r.json() : null)
      .then((body: { ok: boolean; count?: number } | null) => {
        if (body?.count !== undefined) setOpenTickets(body.count)
      })
      .catch(() => {})
  }, [])

  /* Close drawer on route change and on desktop resize */
  useEffect(() => { setIsMobileOpen(false) }, [pathname])
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setIsMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <div className={styles.mobileTopBar}>
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={() => setIsMobileOpen(v => !v)}
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileOpen}
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className={styles.logoText}>
          Activo<strong>ADMIN</strong>
        </span>
      </div>

      {isMobileOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ''}`}>
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
        <button type="button" className={styles.logoutBtn} aria-label="Cerrar sesión" onClick={() => void handleLogout()}>
          <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Salir</span>
        </button>
      </div>
      </aside>
    </>
  )
}
