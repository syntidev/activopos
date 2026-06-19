'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Users,
  Package,
  Calculator,
  BarChart2,
  TrendingUp,
  Activity,
  Store,
  Sparkles,
  Settings,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import styles from './Sidebar.module.css'

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
}

interface NavGroup {
  label: string
  adminOnly?: boolean
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { href: '/escritorio', icon: LayoutDashboard, label: 'Escritorio' },
    ],
  },
  {
    label: 'VENTAS',
    items: [
      { href: '/pos',      icon: ShoppingCart, label: 'Punto de Venta' },
      { href: '/pedidos',  icon: ShoppingBag,  label: 'Pedidos' },
      { href: '/clientes', icon: Users,         label: 'Clientes' },
    ],
  },
  {
    label: 'INVENTARIO',
    items: [
      { href: '/productos', icon: Package, label: 'Productos' },
    ],
  },
  {
    label: 'CAJA',
    items: [
      { href: '/caja',     icon: Calculator, label: 'Gestión de Caja' },
      { href: '/reportes', icon: BarChart2,  label: 'Reportes' },
    ],
  },
  {
    label: 'CATÁLOGO',
    adminOnly: true,
    items: [
      { href: '/catalogo-digital', icon: Store, label: 'Catálogo Digital' },
    ],
  },
  {
    label: 'FINANZAS',
    adminOnly: true,
    items: [
      { href: '/finanzas',   icon: TrendingUp, label: 'Finanzas' },
      { href: '/analytics',  icon: Activity,   label: 'Pulso del Negocio' },
    ],
  },
  {
    label: 'INTELIGENCIA',
    adminOnly: true,
    items: [
      { href: '/tu-dia', icon: Sparkles, label: 'Tu Día' },
    ],
  },
  {
    label: 'SISTEMA',
    adminOnly: true,
    items: [
      { href: '/configuracion', icon: Settings,   label: 'Configuración' },
      { href: '/ayuda',         icon: HelpCircle, label: 'Ayuda' },
    ],
  },
]

const LABEL_MOTION = {
  initial: { opacity: 0, width: 0 },
  animate: { opacity: 1, width: 'auto', transition: { duration: 0.15, delay: 0.08 } },
  exit:    { opacity: 0, width: 0,      transition: { duration: 0.1 } },
}

const GROUP_LABEL_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.15, delay: 0.06 } },
  exit:    { opacity: 0, height: 0,      transition: { duration: 0.1 } },
}

/* ── Inner content — extracted so React keeps stable component identity ── */
interface NavContentProps {
  pathname: string
  collapsed: boolean
  visibleGroups: NavGroup[]
  bcvRate: number | null
  formatRate: (rate: number) => string
  onLogout: () => void
}

function NavContent({
  pathname,
  collapsed,
  visibleGroups,
  bcvRate,
  formatRate,
  onLogout,
}: NavContentProps) {
  return (
    <div className={styles.inner}>
      {/* Logo */}
      <div className={styles.logoWrapper}>
        <div className={styles.logoRow} aria-label="ActivoPOS">
          <span className={styles.logoDot} aria-hidden="true">●</span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="logo-text" className={styles.logoText} {...LABEL_MOTION}>
                <span className={styles.logoActivo}>Activo</span>
                <span className={styles.logoPos}>POS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Navigation */}
      <nav className={styles.nav} aria-label="Menú principal">
        {visibleGroups.map((group) => (
          <div key={group.label} className={styles.group}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p
                  key={`gl-${group.label}`}
                  className={styles.groupLabel}
                  {...GROUP_LABEL_MOTION}
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            <ul className={styles.groupList} role="list">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href + '/'))

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className={styles.iconWrapper}>
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          aria-hidden="true"
                        />
                      </span>
                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            key={`il-${item.href}`}
                            className={styles.navLabel}
                            {...LABEL_MOTION}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        {bcvRate && (
          <div
            className={`${styles.bcvRate} ${collapsed ? styles.bcvRateCollapsed : ''}`}
            title={collapsed ? `USD/VES ${formatRate(bcvRate)} Bs` : undefined}
          >
            {collapsed ? (
              <span
                className={styles.bcvValue}
                aria-label={`Tasa ${Math.round(bcvRate)} Bs`}
              >
                {Math.round(bcvRate)}
              </span>
            ) : (
              <>
                <span className={styles.bcvLabel}>USD/VES</span>
                <span className={styles.bcvValue}>{formatRate(bcvRate)} Bs</span>
              </>
            )}
          </div>
        )}

        <button
          className={styles.logoutBtn}
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="logout-label" className={styles.navLabel} {...LABEL_MOTION}>
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  )
}

/* ── Sidebar ── */
interface SidebarProps {
  session: SessionUser | null
  bcvRate: number | null
  isCollapsed: boolean
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  session,
  bcvRate,
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  const visibleGroups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin)

  const formatRate = (rate: number) =>
    rate.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }, [router])

  const handleMobileLogout = useCallback(async () => {
    onCloseMobile()
    await handleLogout()
  }, [onCloseMobile, handleLogout])

  const sharedProps: Omit<NavContentProps, 'collapsed' | 'onLogout'> = {
    pathname,
    visibleGroups,
    bcvRate,
    formatRate,
  }

  return (
    <>
      {/* Desktop sidebar — always mounted, animates width */}
      <motion.aside
        className={styles.sidebar}
        animate={{ width: isCollapsed ? 64 : 220 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.8 }}
        aria-label="Barra lateral"
      >
        <NavContent {...sharedProps} collapsed={isCollapsed} onLogout={handleLogout} />
      </motion.aside>

      {/* Mobile drawer — mounts on demand, slides from left */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            className={`${styles.sidebar} ${styles.sidebarMobile}`}
            initial={{ x: -220 }}
            animate={{ x: 0 }}
            exit={{ x: -220 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            aria-label="Barra lateral"
            aria-modal="true"
            role="dialog"
          >
            <NavContent {...sharedProps} collapsed={false} onLogout={handleMobileLogout} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
