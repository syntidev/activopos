'use client'

import { usePathname } from 'next/navigation'
import { Menu, Sun, Moon } from 'lucide-react'
import type { SessionUser } from '@/types'
import styles from './Header.module.css'

interface HeaderProps {
  session: SessionUser | null
  bcvRate: number | null
  isCollapsed: boolean
  theme: 'dark' | 'light'
  onToggleCollapse: () => void
  onToggleMobile: () => void
  onToggleTheme: () => void
}

const PAGE_TITLES: Array<[string, string]> = [
  ['/escritorio',    'Escritorio'],
  ['/pos',           'Punto de Venta'],
  ['/cotizaciones',  'Cotizaciones'],
  ['/clientes',      'Clientes'],
  ['/productos',     'Productos'],
  ['/devoluciones',  'Devoluciones'],
  ['/caja',          'Gestión de Caja'],
  ['/reportes',      'Reportes'],
  ['/finanzas',      'Finanzas'],
  ['/usuarios',      'Usuarios'],
  ['/configuracion', 'Configuración'],
  ['/ayuda',         'Ayuda'],
]

const ROLE_LABELS: Record<SessionUser['role'], string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  cashier:     'Cajero',
}

const ROLE_CLASSES: Record<SessionUser['role'], string> = {
  admin:       styles.roleAdmin,
  cashier:     styles.roleCashier,
  super_admin: styles.roleSuperAdmin,
}

export function Header({
  session,
  bcvRate,
  isCollapsed,
  theme,
  onToggleCollapse,
  onToggleMobile,
  onToggleTheme,
}: HeaderProps) {
  const pathname = usePathname()

  const pageTitle =
    PAGE_TITLES.find(
      ([path]) => pathname === path || pathname.startsWith(path + '/')
    )?.[1] ?? 'ActivoPOS'

  const formatRate = (rate: number) =>
    rate.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const roleLabel = session ? ROLE_LABELS[session.role] : ''
  const roleClass = session ? ROLE_CLASSES[session.role] : ''

  return (
    <header className={styles.header} role="banner">
      {/* Left: hamburger + page title */}
      <div className={styles.left}>
        {/* Desktop: toggles sidebar collapse */}
        <button
          className={styles.hamburgerDesktop}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          aria-expanded={!isCollapsed}
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {/* Mobile: opens drawer */}
        <button
          className={styles.hamburgerMobile}
          onClick={onToggleMobile}
          aria-label="Abrir menú de navegación"
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      {/* Right: BCV rate + theme toggle + user info */}
      <div className={styles.right}>
        {bcvRate && (
          <>
            <div
              className={styles.bcvPill}
              title="Tasa BCV oficial"
              aria-label={`Tasa BCV: ${formatRate(bcvRate)} bolívares por dólar`}
            >
              <span className={styles.bcvCurrency}>USD/VES</span>
              <span className={styles.bcvAmount}>{formatRate(bcvRate)}</span>
              <span className={styles.bcvBs}>Bs</span>
            </div>
            <div className={styles.separator} aria-hidden="true" />
          </>
        )}

        {/* Theme toggle */}
        <button
          className={styles.themeToggle}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? (
            <Sun size={18} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>

        {session && (
          <>
            <div className={styles.separator} aria-hidden="true" />
            <div className={styles.userInfo} aria-label={`Usuario: ${session.name}`}>
              <span className={styles.userName}>{session.name}</span>
              <span className={`${styles.roleBadge} ${roleClass}`}>
                {roleLabel}
              </span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
