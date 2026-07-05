'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, Sun, Moon, Bell, ShoppingBag, Package, CreditCard, CheckCheck, X } from 'lucide-react'
import type { SessionUser } from '@/types'
import { CajaToggle } from './CajaToggle'
import styles from './Header.module.css'

interface BizInfo { name: string; logo_path: string | null }

function bizInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface NotificationItem {
  id: number
  type: 'order' | 'stock' | 'debt' | string
  title: string
  body?: string
  /** @deprecated use title */
  message?: string
  url?: string
  read: boolean
  created_at: string
}

const NOTIF_ICONS: Record<string, { Icon: React.ElementType; cls: string }> = {
  order: { Icon: ShoppingBag, cls: styles.notifIconOrder },
  stock: { Icon: Package,     cls: styles.notifIconStock },
  debt:  { Icon: CreditCard,  cls: styles.notifIconDebt  },
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Hace ${diffH}h`
  return `Hace ${Math.floor(diffH / 24)}d`
}

interface HeaderProps {
  session: SessionUser | null
  bcvRate: number | null
  isCollapsed: boolean
  onToggleCollapse: () => void
  onToggleMobile: () => void
}

/* ── Tasa del día ── */

interface RateInfo {
  rate: number
  source: string
  manual_active: boolean
  bcv_rate: number
}

const fmtRateEs = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface RateModalProps {
  info: RateInfo
  isAdmin: boolean
  onClose: () => void
  onChanged: () => Promise<void>
}

function RateModal({ info, isAdmin, onClose, onChanged }: RateModalProps) {
  const [manualOn,  setManualOn]  = useState(info.manual_active)
  const [rateInput, setRateInput] = useState(info.manual_active ? String(info.rate) : '')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const submit = useCallback(async (active: boolean, rate?: number) => {
    setSaving(true); setErr('')
    try {
      const payload = active && rate != null ? { rate, active: true } : { active: false }
      const res = await fetch('/api/rates/manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j?.error ?? 'No se pudo actualizar la tasa')
        return
      }
      await onChanged()
      onClose()
    } catch {
      setErr('Error de conexión')
    } finally {
      setSaving(false)
    }
  }, [onChanged, onClose])

  const handleToggle = (checked: boolean) => {
    setManualOn(checked)
    setErr('')
    // Apagar el override manual persiste de inmediato (vuelve a BCV)
    if (!checked && info.manual_active) void submit(false)
  }

  const handleApply = () => {
    const n = parseFloat(rateInput)
    if (isNaN(n) || n <= 0) { setErr('Ingresa una tasa válida'); return }
    void submit(true, n)
  }

  return (
    <div
      className={styles.rateOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Tasa del día"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className={styles.rateModal}>
        <div className={styles.rateModalHeader}>
          <h2 className={styles.rateModalTitle}>Tasa del día</h2>
          <button type="button" className={styles.rateModalClose} onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {/* BCV de referencia */}
        <div className={styles.rateInfoBox}>
          <span className={styles.rateInfoLabel}>BCV oficial (referencia)</span>
          <span className={styles.rateInfoValue}>Bs. {fmtRateEs(info.bcv_rate)}</span>
        </div>

        {/* Tasa activa actual */}
        <div className={styles.rateActiveRow}>
          <span className={styles.rateInfoLabel}>Tasa activa del sistema</span>
          <span className={`${styles.rateActiveValue} ${info.manual_active ? styles.rateActiveManual : ''}`}>
            Bs. {fmtRateEs(info.rate)}
            <span className={styles.rateSourceTag}>{info.manual_active ? 'Manual' : 'BCV'}</span>
          </span>
        </div>

        {isAdmin ? (
          <>
            <label className={styles.rateToggleRow}>
              <span className={styles.rateToggleText}>Usar tasa manual</span>
              <span className={styles.rateToggle}>
                <input
                  type="checkbox"
                  className={styles.rateToggleInput}
                  checked={manualOn}
                  onChange={(e) => handleToggle(e.target.checked)}
                  disabled={saving}
                />
                <span className={styles.rateToggleTrack} />
                <span className={styles.rateToggleThumb} />
              </span>
            </label>

            {manualOn && (
              <div className={styles.rateInputRow}>
                <div className={styles.rateInputWrap}>
                  <span className={styles.rateInputPrefix}>Bs.</span>
                  <input
                    type="number"
                    className={styles.rateInput}
                    value={rateInput}
                    onChange={(e) => { setRateInput(e.target.value); setErr('') }}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Tasa manual en bolívares"
                    autoFocus
                    disabled={saving}
                  />
                </div>
                <button
                  type="button"
                  className={styles.rateApplyBtn}
                  onClick={handleApply}
                  disabled={saving || !rateInput.trim()}
                >
                  {saving ? 'Aplicando…' : 'Aplicar tasa manual'}
                </button>
              </div>
            )}

            {err && <p className={styles.rateErr}>{err}</p>}
          </>
        ) : (
          <p className={styles.rateReadonlyNote}>Solo un administrador puede cambiar la tasa.</p>
        )}

        <div className={styles.rateFooter}>
          <button type="button" className={styles.rateCancelBtn} onClick={onClose} disabled={saving}>
            {isAdmin && manualOn ? 'Cancelar' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  )
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
  onToggleCollapse,
  onToggleMobile,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isAdmin = session?.role === 'admin' || session?.role === 'super_admin'

  /* ── Tasa del día (badge + modal) ── */
  const [rateInfo, setRateInfo]         = useState<RateInfo | null>(null)
  const [rateModalOpen, setRateModalOpen] = useState(false)

  const fetchRateInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/bcv')
      if (!res.ok) return
      const j = await res.json() as Partial<RateInfo> & { ok?: boolean }
      if (j.ok && typeof j.rate === 'number') {
        setRateInfo({
          rate:          j.rate,
          source:        j.source ?? 'bcv',
          manual_active: !!j.manual_active,
          bcv_rate:      typeof j.bcv_rate === 'number' ? j.bcv_rate : j.rate,
        })
      }
    } catch { /* graceful — badge cae al prop bcvRate */ }
  }, [])

  useEffect(() => { void fetchRateInfo() }, [fetchRateInfo])

  /* ── Business brand (desktop left) ── */
  const [biz, setBiz] = useState<BizInfo | null>(null)
  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.ok ? r.json() : null)
      .then((j: BizInfo | null) => { if (j?.name) setBiz({ name: j.name, logo_path: j.logo_path ?? null }) })
      .catch(() => {})
  }, [])

  /* ── Notifications ── */
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const notifBellRef = useRef<HTMLButtonElement>(null)
  const notifPanelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res = await fetch('/api/notifications/history')
      if (!res.ok) return
      const data = await res.json() as { items?: NotificationItem[] }
      const items = data.items ?? []
      setNotifications(items)
      setUnreadCount(items.filter(n => !n.read).length)
    } catch {
      // endpoint not yet available — show empty state
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const pollUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/history')
      if (!res.ok) return
      const data = await res.json() as { items?: NotificationItem[] }
      const items = data.items ?? []
      setUnreadCount(items.filter(n => !n.read).length)
    } catch { /* graceful */ }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' })
    } catch { /* graceful */ }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const handleToggleNotif = useCallback(async () => {
    const opening = !notifOpen
    setNotifOpen(opening)
    if (opening) await fetchNotifications()
  }, [notifOpen, fetchNotifications])

  /* Initial fetch + 60s polling for unread badge */
  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(() => { void pollUnreadCount() }, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications, pollUnreadCount])

  useEffect(() => {
    if (!notifOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const inBell  = notifBellRef.current?.contains(target)
      const inPanel = notifPanelRef.current?.contains(target)
      if (!inBell && !inPanel) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notifOpen])

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
    <>
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

          {/* Desktop: business brand — logo + name */}
          {biz && (
            <>
              <div className={styles.bizBrand} aria-label={`Negocio: ${biz.name}`}>
                {biz.logo_path?.startsWith('/uploads/') ? (
                  <img
                    src={biz.logo_path}
                    alt={biz.name}
                    className={styles.bizLogo}
                  />
                ) : (
                  <span className={styles.bizInitials} aria-hidden="true">
                    {bizInitials(biz.name)}
                  </span>
                )}
                <span className={styles.bizName}>{biz.name}</span>
              </div>
              <div className={styles.bizSep} aria-hidden="true" />
            </>
          )}

          <h1 className={styles.pageTitle}>{pageTitle}</h1>
        </div>

        {/* Mobile: brand in center */}
        <div className={styles.mobileBrand} aria-label="ActivoPOS">
          <img src="/activopos-3d.svg" alt="ActivoPOS" className={styles.mobileBrandLogo} />
          <span className={styles.mobileBrandName}>
            <span className={styles.mobileBrandActivo}>Activo</span>
            <span className={styles.mobileBrandPOS}>POS</span>
          </span>
        </div>

        {/* Right: BCV rate + caja + notif + theme + user */}
        <div className={styles.right}>
          {(rateInfo?.rate ?? bcvRate) != null && (
            <>
              <button
                type="button"
                className={`${styles.bcvPill} ${rateInfo?.manual_active ? styles.bcvPillManual : ''}`}
                onClick={() => setRateModalOpen(true)}
                title={rateInfo?.manual_active ? 'Tasa manual activa — clic para configurar' : 'Tasa BCV oficial — clic para configurar'}
                aria-label={`Tasa ${rateInfo?.manual_active ? 'manual' : 'BCV'}: ${formatRate(rateInfo?.rate ?? bcvRate ?? 0)} bolívares por dólar. Abrir configuración de tasa.`}
              >
                <span className={styles.bcvCurrency}>USD/VES</span>
                <span className={styles.bcvAmount}>{formatRate(rateInfo?.rate ?? bcvRate ?? 0)}</span>
                <span className={styles.bcvBs}>Bs</span>
                {rateInfo?.manual_active && <span className={styles.bcvManualDot} aria-hidden="true" />}
              </button>
              <div className={styles.separator} aria-hidden="true" />
            </>
          )}

          {/* Caja status toggle — hidden on mobile, shown in sidebar drawer instead */}
          <div className={styles.cajaToggleWrap}>
            <CajaToggle />
          </div>

          {/* Notification bell */}
          <button
            ref={notifBellRef}
            className={styles.notifBtn}
            onClick={() => { void handleToggleNotif() }}
            aria-label={`Notificaciones${unreadCount > 0 ? ` — ${unreadCount} sin leer` : ''}`}
            aria-expanded={notifOpen}
            aria-haspopup="true"
          >
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className={styles.notifBadge} aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            className={styles.themeToggle}
            onClick={() => { if (mounted) setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') }}
            aria-label={mounted && resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={mounted && resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {mounted && resolvedTheme === 'dark' ? (
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

      {/* Notification panel — rendered outside header to avoid backdrop-filter stacking context */}
      {notifOpen && (
        <div
          ref={notifPanelRef}
          className={styles.notifPanel}
          role="dialog"
          aria-label="Notificaciones"
        >
          <div className={styles.notifPanelHeader}>
            <span className={styles.notifPanelTitle}>Notificaciones</span>
            {!notifLoading && unreadCount > 0 ? (
              <button
                type="button"
                className={styles.markAllReadBtn}
                onClick={() => { void markAllRead() }}
                aria-label="Marcar todas como leídas"
              >
                <CheckCheck size={13} aria-hidden="true" />
                Marcar leídas
              </button>
            ) : !notifLoading && notifications.length > 0 ? (
              <span className={styles.notifAllRead}>Todas leídas</span>
            ) : null}
          </div>

          <div className={styles.notifList}>
            {notifLoading ? (
              <div className={styles.notifLoadingState}>
                <span className={styles.notifSpinner} aria-hidden="true" />
                Cargando...
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.notifEmptyState}>
                <Bell size={24} className={styles.notifEmptyIcon} aria-hidden="true" />
                <span>No hay notificaciones pendientes</span>
              </div>
            ) : (
              notifications.map(n => {
                const { Icon, cls } = NOTIF_ICONS[n.type] ?? { Icon: Bell, cls: '' }
                const label = n.title ?? n.message ?? ''
                return (
                  <div
                    key={n.id}
                    className={`${styles.notifItem} ${n.read ? styles.notifItemRead : ''} ${n.url ? styles.notifItemClickable : ''}`}
                    role={n.url ? 'button' : undefined}
                    tabIndex={n.url ? 0 : undefined}
                    onClick={() => {
                      if (n.url) {
                        router.push(n.url)
                        setNotifOpen(false)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (n.url && (e.key === 'Enter' || e.key === ' ')) {
                        router.push(n.url)
                        setNotifOpen(false)
                      }
                    }}
                  >
                    <span className={`${styles.notifIconCircle} ${cls}`} aria-hidden="true">
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <div className={styles.notifItemBody}>
                      <p className={styles.notifItemTitle}>{label}</p>
                      {n.body && <p className={styles.notifItemDesc}>{n.body}</p>}
                      <p className={styles.notifItemTime}>{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Tasa del día */}
      {rateModalOpen && rateInfo && (
        <RateModal
          info={rateInfo}
          isAdmin={isAdmin}
          onClose={() => setRateModalOpen(false)}
          onChanged={fetchRateInfo}
        />
      )}
    </>
  )
}
