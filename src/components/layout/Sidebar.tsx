'use client'

import { useState, useCallback, useEffect } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useNotifications } from '@/hooks/useNotifications'
import { useSidebarNotifications, type SidebarCounts } from '@/hooks/useSidebarNotifications'
import { NotificationsPanel } from './NotificationsPanel'
import { CajaToggle } from './CajaToggle'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Bell,
  ChefHat,
  Receipt,
  Truck,
  Shield,
  ArrowRightLeft,
  FileText,
  ChevronDown,
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
  badgeKey?: 'pending_orders' | 'cxp_vencidas'
  /** Oculta el item a cashier aunque el grupo sea visible (item con datos de costo) */
  adminOnly?: boolean
  /** Además del toggle en modules_enabled, requiere que el plan del tenant lo incluya */
  requiresCatalogPlan?: boolean
}

interface NavGroup {
  label: string
  adminOnly?: boolean
  /** Grupo plegable — estado persiste en localStorage */
  collapsible?: boolean
  items: NavItem[]
}

const COLLAPSED_GROUPS_KEY = 'activopos:sidebar:collapsedGroups'

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
      // adminOnly explícito: venía del grupo FINANZAS, que lo es a nivel de
      // grupo. VENTAS no lo es, y /api/quotations rechaza al cajero con 403.
      { href: '/cotizaciones', icon: FileText,  label: 'Cotizaciones',                         colorKey: 'ventas', adminOnly: true },
      { href: '/clientes', icon: Users,         label: 'Clientes',                             colorKey: 'ventas' },
    ],
  },
  {
    label: 'INVENTARIO',
    collapsible: true,
    items: [
      { href: '/productos',  icon: Package,        label: 'Productos',   moduleKey: 'inventory', colorKey: 'inventario', adminOnly: true },
      { href: '/inventario', icon: ArrowRightLeft, label: 'Movimientos', colorKey: 'inventario', adminOnly: true },
      { href: '/proveedores', icon: Truck,          label: 'Proveedores', moduleKey: 'suppliers', colorKey: 'inventario', adminOnly: true },
    ],
  },
  {
    label: 'CAJA',
    items: [
      { href: '/caja',     icon: Calculator, label: 'Gestión de Caja', moduleKey: 'caja',     colorKey: 'caja' },
      { href: '/reportes', icon: BarChart2,  label: 'Reportes',        moduleKey: 'reportes', colorKey: 'caja', adminOnly: true },
    ],
  },
  {
    label: 'FINANZAS',
    adminOnly: true,
    collapsible: true,
    items: [
      { href: '/finanzas',     icon: TrendingUp, label: 'Finanzas',     moduleKey: 'finanzas', colorKey: 'caja', badgeKey: 'cxp_vencidas' },
    ],
  },
  {
    label: 'CATÁLOGO',
    adminOnly: true,
    items: [
      { href: '/catalogo-digital', icon: Store, label: 'Catálogo Digital', moduleKey: 'catalog', colorKey: 'inventario', requiresCatalogPlan: true },
    ],
  },
  /* ── Grupos preservados: no listados en la nueva estructura pedida,
     mantenidos para no perder acceso a KDS / Analytics / Tu Día (ninguna
     ruta se elimina — ver nota en el commit) ── */
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
      { href: '/analytics', icon: Activity,  label: 'Pulso del Negocio', moduleKey: 'analytics', colorKey: 'inteligencia' },
      { href: '/tu-dia',    icon: Sparkles,  label: 'Tu Día',                                    colorKey: 'inteligencia' },
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

const GROUP_LIST_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.18, ease: 'easeOut' } },
  exit:    { opacity: 0, height: 0,      transition: { duration: 0.14, ease: 'easeIn' } },
} as const

/* ── Inner content — extracted so React keeps stable component identity ── */
interface NavContentProps {
  pathname: string
  collapsed: boolean
  visibleGroups: NavGroup[]
  bcvRate: number | null
  formatRate: (rate: number) => string
  onCloseMobile?: () => void
  onCloseNotifications?: () => void
  onOpenNotifications?: () => void
  notifUnread?: number
  enabledModules?: string[] | null
  catalogPlanAllowed?: boolean
  sidebarCounts?: SidebarCounts
  showMobileInfo?: boolean
  session?: SessionUser | null
  isImpersonating?: boolean
  isAdmin: boolean
  collapsedGroups: Set<string>
  onToggleGroup: (label: string) => void
}

function NavContent({
  pathname,
  collapsed,
  visibleGroups,
  bcvRate,
  formatRate,
  onCloseMobile,
  onCloseNotifications,
  onOpenNotifications,
  notifUnread = 0,
  enabledModules,
  catalogPlanAllowed = true,
  sidebarCounts,
  showMobileInfo = false,
  session,
  isImpersonating = false,
  isAdmin,
  collapsedGroups,
  onToggleGroup,
}: NavContentProps) {
  return (
    <div className={styles.inner}>
      {/* Logo */}
      <div className={styles.logoWrapper}>
        <div className={styles.logoRow} aria-label="ActivoPOS">
          <img src="/activopos-logo-flat-positive.svg" alt="ActivoPOS" className={styles.logoImg} />
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

      {/* Abrir Caja — vive en el sidebar para todas las franjas (antes solo
          aparecía en el header desktop y en el footer del drawer móvil) */}
      <div className={styles.cajaTopWrap}>
        <CajaToggle collapsed={collapsed} />
      </div>

      <div className={styles.divider} />

      {/* Navigation */}
      <nav className={styles.nav} aria-label="Menú principal">
        {visibleGroups.map((group) => {
          const visibleItems = group.items.filter(item =>
            (!item.moduleKey || !enabledModules || enabledModules.includes(item.moduleKey)) &&
            (!item.requiresCatalogPlan || catalogPlanAllowed) &&
            (!item.adminOnly || isAdmin)
          )
          if (visibleItems.length === 0) return null

          const isGroupCollapsed = !!group.collapsible && !collapsed && collapsedGroups.has(group.label)
          const listId = `group-list-${group.label}`

          return (
          <div key={group.label} className={styles.group}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                group.collapsible ? (
                  <motion.button
                    key={`gl-${group.label}`}
                    type="button"
                    className={styles.groupLabelBtn}
                    onClick={() => onToggleGroup(group.label)}
                    aria-expanded={!isGroupCollapsed}
                    aria-controls={listId}
                    {...GROUP_LABEL_MOTION}
                  >
                    <span className={styles.groupLabelText}>{group.label}</span>
                    <ChevronDown
                      size={12}
                      className={`${styles.groupChevron} ${isGroupCollapsed ? styles.groupChevronCollapsed : ''}`}
                      aria-hidden="true"
                    />
                  </motion.button>
                ) : (
                  <motion.p
                    key={`gl-${group.label}`}
                    className={styles.groupLabel}
                    {...GROUP_LABEL_MOTION}
                  >
                    {group.label}
                  </motion.p>
                )
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {!isGroupCollapsed && (
            <motion.ul
              id={listId}
              key={`ul-${group.label}`}
              className={styles.groupList}
              role="list"
              {...(group.collapsible ? GROUP_LIST_MOTION : {})}
            >
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
                        {item.badgeKey === 'cxp_vencidas' && (sidebarCounts?.cxpVencidas ?? 0) > 0 && (
                          <span
                            className={styles.itemBadgeRed}
                            aria-label={`${sidebarCounts?.cxpVencidas} cuentas por pagar vencidas`}
                          >
                            {(sidebarCounts?.cxpVencidas ?? 0) > 9 ? '9+' : sidebarCounts?.cxpVencidas}
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
            </motion.ul>
              )}
            </AnimatePresence>
          </div>
          )
        })}
      </nav>

      {session?.role === 'super_admin' && !isImpersonating && (
        <>
          <div className={styles.divider} />
          <Link
            href="/businesses"
            className={`${styles.navItem} ${styles.adminPanelLink}`}
            title={collapsed ? 'Panel Admin' : undefined}
            onClick={() => { onCloseMobile?.(); onCloseNotifications?.() }}
          >
            <span className={styles.iconWrapper}>
              <Shield size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span key="admin-panel-label" className={styles.navLabel} {...LABEL_MOTION}>
                  Panel Admin
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </>
      )}

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
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sidebar ── */
interface SidebarProps {
  session: SessionUser | null
  isImpersonating: boolean
  bcvRate: number | null
  isCollapsed: boolean
  isMobileOpen: boolean
  onCloseMobile: () => void
  enabledModules?: string[] | null
  catalogPlanAllowed?: boolean
}

export function Sidebar({
  session,
  isImpersonating,
  bcvRate,
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  enabledModules,
  catalogPlanAllowed,
}: SidebarProps) {
  useScrollLock(isMobileOpen)

  const pathname = usePathname()
  const [showNotif, setShowNotif] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const { items: notifItems, unread: notifUnread, loading: notifLoading, markAllRead } = useNotifications()

  /* ── Tablet (768-1023px): rail dockeado auto-colapsado a solo íconos,
     independiente del toggle manual de escritorio (isCollapsed) ── */
  const [isTabletAutoCollapsed, setIsTabletAutoCollapsed] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const update = () => setIsTabletAutoCollapsed(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const effectiveCollapsed = isCollapsed || isTabletAutoCollapsed
  const railWidth = isTabletAutoCollapsed ? 56 : (isCollapsed ? 64 : 220)

  const sidebarCounts = useSidebarNotifications()
  const isAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  const visibleGroups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin)

  /* ── Grupos colapsables — estado persistido en localStorage ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY)
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]))
    } catch { /* localStorage no disponible o valor corrupto — usar default expandido */ }
  }, [])

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next))) } catch { /* quota o modo privado */ }
      return next
    })
  }, [])

  const formatRate = (rate: number) =>
    rate.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const sharedProps: Omit<NavContentProps, 'collapsed'> = {
    pathname,
    visibleGroups,
    bcvRate,
    formatRate,
    onCloseMobile,
    onCloseNotifications: () => setShowNotif(false),
    onOpenNotifications: () => setShowNotif(true),
    notifUnread,
    enabledModules,
    catalogPlanAllowed,
    sidebarCounts,
    session,
    isImpersonating,
    isAdmin,
    collapsedGroups,
    onToggleGroup: toggleGroup,
  }

  return (
    <>
      {/* Desktop sidebar — always mounted, animates width */}
      <motion.aside
        className={styles.sidebar}
        animate={{ width: railWidth }}
        transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.8 }}
        aria-label="Barra lateral"
      >
        <NavContent {...sharedProps} collapsed={effectiveCollapsed} />
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
            <NavContent {...sharedProps} collapsed={false} showMobileInfo />
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
