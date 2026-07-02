'use client'

import { useState, useCallback } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useNotifications } from '@/hooks/useNotifications'
import { useSidebarNotifications, type SidebarCounts } from '@/hooks/useSidebarNotifications'
import { NotificationsPanel } from './NotificationsPanel'
import { CajaToggle } from './CajaToggle'
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
  Bell,
  ChefHat,
  Receipt,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import styles from './Sidebar.module.css'

const ROLE_LABELS: Record<SessionUser['role'], string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  cashier:     'Cajero',
}

const ROLE_BADGE_CLASSES: Record<SessionUser['role'], string> = {
  admin:       styles.roleAdmin,
  cashier:     styles.roleCashier,
  super_admin: styles.roleSuperAdmin,
}

const ICON_COLOR_CLASSES: Record<string, string> = {
  ventas:        styles.iconColorVentas,
  inventario:    styles.iconColorInventario,
  caja:          styles.iconColorCaja,
  inteligencia:  styles.iconColorInteligencia,
  admin:         styles.iconColorAdmin,
}

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  moduleKey?: string
  colorKey?: string
  badgeKey?: 'pending_orders'
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
      { href: '/escritorio', icon: LayoutDashboard, label: 'Escritorio', colorKey: 'ventas' },
    ],
  },
  {
    label: 'VENTAS',
    items: [
      { href: '/pos',      icon: ShoppingCart, label: 'Punto de Venta', moduleKey: 'pos',     colorKey: 'ventas' },
      { href: '/pedidos',  icon: ShoppingBag,  label: 'Pedidos',        moduleKey: 'pedidos', colorKey: 'ventas', badgeKey: 'pending_orders' },
      { href: '/ventas',   icon: Receipt,       label: 'Historial',                            colorKey: 'ventas' },
      { href: '/clientes', icon: Users,         label: 'Clientes',                             colorKey: 'ventas' },
    ],
  },
  {
    label: 'INVENTARIO',
    items: [
      { href: '/productos', icon: Package, label: 'Productos', moduleKey: 'inventory', colorKey: 'inventario' },
    ],
  },
  {
    label: 'CAJA',
    items: [
      { href: '/caja',     icon: Calculator, label: 'Gestión de Caja', moduleKey: 'caja',     colorKey: 'caja' },
      { href: '/reportes', icon: BarChart2,  label: 'Reportes',        moduleKey: 'reportes', colorKey: 'caja' },
    ],
  },
  {
    label: 'CATÁLOGO',
    adminOnly: true,
    items: [
      { href: '/catalogo-digital', icon: Store, label: 'Catálogo Digital', moduleKey: 'catalog', colorKey: 'inventario' },
    ],
  },
  {
    label: 'FINANZAS',
    adminOnly: true,
    items: [
      { href: '/finanzas',  icon: TrendingUp, label: 'Finanzas',          moduleKey: 'finanzas',  colorKey: 'caja'         },
      { href: '/analytics', icon: Activity,   label: 'Pulso del Negocio', moduleKey: 'analytics', colorKey: 'inteligencia' },
    ],
  },
  {
    label: 'PROVEEDORES',
    adminOnly: true,
    items: [
      { href: '/proveedores', icon: Truck, label: 'Proveedores', colorKey: 'inventario' },
    ],
  },
  {
    label: 'RESTAURANTE',
    adminOnly: true,
    items: [
      { href: '/kds', icon: ChefHat, label: 'Cocina (KDS)', moduleKey: 'kds', colorKey: 'inventario' },
    ],
  },
  {
    label: 'INTELIGENCIA',
    adminOnly: true,
    items: [
      { href: '/tu-dia', icon: Sparkles, label: 'Tu Día', colorKey: 'inteligencia' },
    ],
  },
  {
    label: 'SISTEMA',
    adminOnly: true,
    items: [
      { href: '/configuracion', icon: Settings,   label: 'Configuración', colorKey: 'admin' },
      { href: '/ayuda',         icon: HelpCircle, label: 'Ayuda',         colorKey: 'admin' },
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
  onCloseMobile?: () => void
  onCloseNotifications?: () => void
  onOpenNotifications?: () => void
  notifUnread?: number
  enabledModules?: string[] | null
  sidebarCounts?: SidebarCounts
  showMobileInfo?: boolean
  session?: SessionUser | null
}

function NavContent({
  pathname,
  collapsed,
  visibleGroups,
  bcvRate,
  formatRate,
  onLogout,
  onCloseMobile,
  onCloseNotifications,
  onOpenNotifications,
  notifUnread = 0,
  enabledModules,
  sidebarCounts,
  showMobileInfo = false,
  session,
}: NavContentProps) {
  return (
    <div className={styles.inner}>
      {/* Logo */}
      <div className={styles.logoWrapper}>
        <div className={styles.logoRow} aria-label="ActivoPOS">
          <img src="/activopos-3d.svg" alt="ActivoPOS" className={styles.logoImg} />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="logo-name" className={styles.logoName} {...LABEL_MOTION}>
                <span className={styles.logoActivo}>Activo</span>
                <span className={styles.logoPOS}>POS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Navigation */}
      <nav className={styles.nav} aria-label="Menú principal">
        {visibleGroups.map((group) => {
          const visibleItems = group.items.filter(item =>
            !item.moduleKey || !enabledModules || enabledModules.includes(item.moduleKey)
          )
          if (visibleItems.length === 0) return null
          return (
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
              {visibleItems.map((item) => {
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
                      onClick={() => { onCloseMobile?.(); onCloseNotifications?.() }}
                    >
                      <span className={`${styles.iconWrapper}${!isActive && item.colorKey ? ' ' + (ICON_COLOR_CLASSES[item.colorKey] ?? '') : ''}`}>
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.25 : 1.75}
                          aria-hidden="true"
                        />
                        {item.badgeKey === 'pending_orders' && (sidebarCounts?.pendingOrders ?? 0) > 0 && (
                          <span
                            className={styles.itemBadgeRed}
                            aria-label={`${sidebarCounts?.pendingOrders} pedidos pendientes`}
                          >
                            {(sidebarCounts?.pendingOrders ?? 0) > 9 ? '9+' : sidebarCounts?.pendingOrders}
                          </span>
                        )}
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
          )
        })}
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

        {onOpenNotifications && (
          <button
            className={styles.notifBtn}
            onClick={onOpenNotifications}
            aria-label={notifUnread > 0 ? `${notifUnread} notificaciones sin leer` : 'Notificaciones'}
            title={collapsed ? 'Notificaciones' : undefined}
          >
            <span className={styles.notifIconWrap}>
              <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
              {notifUnread > 0 && (
                <span className={styles.notifBadge} aria-hidden="true">
                  {notifUnread > 9 ? '9+' : notifUnread}
                </span>
              )}
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span key="notif-label" className={styles.navLabel} {...LABEL_MOTION}>
                  Notificaciones
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}

        {showMobileInfo && session && (
          <div className={styles.mobileInfoRow}>
            <div className={styles.mobileUserMeta}>
              <span className={styles.mobileUserName}>{session.name}</span>
              <span className={`${styles.mobileRoleBadge} ${ROLE_BADGE_CLASSES[session.role]}`}>
                {ROLE_LABELS[session.role]}
              </span>
            </div>
            <div className={styles.mobileCajaWrap}>
              <CajaToggle />
            </div>
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
  enabledModules?: string[] | null
}

export function Sidebar({
  session,
  bcvRate,
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  enabledModules,
}: SidebarProps) {
  useScrollLock(isMobileOpen)

  const pathname = usePathname()
  const router = useRouter()
  const [showNotif, setShowNotif] = useState(false)
  const { items: notifItems, unread: notifUnread, loading: notifLoading, markAllRead } = useNotifications()

  const sidebarCounts = useSidebarNotifications()
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
    onCloseMobile,
    onCloseNotifications: () => setShowNotif(false),
    onOpenNotifications: () => setShowNotif(true),
    notifUnread,
    enabledModules,
    sidebarCounts,
    session,
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
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            aria-label="Barra lateral"
            aria-modal="true"
            role="dialog"
          >
            <NavContent {...sharedProps} collapsed={false} onLogout={handleMobileLogout} showMobileInfo />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Notifications panel — rendered outside sidebar for correct z-index */}
      <NotificationsPanel
        open={showNotif}
        onClose={() => setShowNotif(false)}
        items={notifItems}
        loading={notifLoading}
        onMarkAll={markAllRead}
      />
    </>
  )
}
