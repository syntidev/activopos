'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ShoppingBag,
  ChevronRight,
  Clock,
  TriangleAlert,
  PartyPopper,
  Check,
  Circle,
  Copy,
  X,
  Plus,
  Receipt,
  Truck,
} from 'lucide-react'
import { DashboardReportAlert } from '@/components/reports/DashboardReportAlert'
import styles from './escritorio.module.css'

const NEW_TENANT_WINDOW_DAYS = 7
const WELCOME_DISMISSED_KEY  = 'welcome_dismissed'
const CATALOG_SHARED_KEY     = 'catalog_shared'

interface WelcomeStep {
  key:   string
  label: string
  done:  boolean
  href?: string
  onAction?: () => void
}

type Period = 'hoy' | '7dias' | 'mes' | 'trimestre'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'hoy',       label: 'Hoy'       },
  { key: '7dias',     label: '7 días'    },
  { key: 'mes',       label: 'Este mes'  },
  { key: 'trimestre', label: 'Trimestre' },
]

interface AnalyticsSummary {
  ok: boolean
  ventas: {
    total_usd:      number
    total_bs:       number
    count:          number
    avg_ticket_usd: number
    items_sold:     number
  }
  resultado?: {
    utilidad_neta_usd:  number
    utilidad_bruta_usd: number
    costo_ventas_usd:   number
  }
  vs_anterior: {
    variacion_pct: number
    tendencia:     'up' | 'down' | 'flat'
  }
  por_metodo: Array<{
    method_name: string
    total_usd:   number
    count:       number
  }>
}

interface TopProduct {
  id:           number
  name:         string
  qty_sold:     number
  total_usd:    number
  pct_of_total: number
  trend:        'up' | 'down' | 'flat'
}

interface ChartsMin {
  low_stock_count: number
}

interface CreditData {
  total: number
  count: number
}

interface TodayVentas {
  totalUsd: number
  utilidad: number
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function getRange(period: Period): { from: string; to: string } {
  const now      = new Date()
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (period === 'hoy') {
    return { from: toDateStr(today), to: toDateStr(tomorrow) }
  }
  if (period === '7dias') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { from: toDateStr(from), to: toDateStr(tomorrow) }
  }
  if (period === 'mes') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toDateStr(from), to: toDateStr(tomorrow) }
  }
  const from = new Date(today)
  from.setDate(from.getDate() - 89)
  return { from: toDateStr(from), to: toDateStr(tomorrow) }
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function fmtUsd(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBsVal(v: number) {
  return 'Bs. ' + v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNum(v: number) {
  return v.toLocaleString('es-VE')
}

const METODO_LABELS: Record<string, string> = {
  efectivo:     'Efectivo',
  transferencia:'Transferencia',
  zelle:        'Zelle',
  binance:      'Binance',
  debito:       'Débito',
  credito:      'Crédito',
  usd_efectivo: 'USD Efectivo',
  otro:         'Otro',
}

export default function EscritorioPage() {
  const [period,       setPeriod]       = useState<Period>('7dias')
  const [summary,      setSummary]      = useState<AnalyticsSummary | null>(null)
  const [products,     setProducts]     = useState<TopProduct[]>([])
  const [lowStock,     setLowStock]     = useState<number | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [creditData,   setCreditData]   = useState<CreditData | null>(null)
  const [todayVentas,  setTodayVentas]  = useState<TodayVentas | null>(null)
  const [gastosAlert,  setGastosAlert]  = useState<{ count: number } | null>(null)

  const [welcomeDismissed, setWelcomeDismissed] = useState(true) // true por defecto — evita flash mientras se resuelve localStorage
  const [isNewTenant,      setIsNewTenant]       = useState(false)
  const [hasLogo,          setHasLogo]           = useState(false)
  const [hasProducts,      setHasProducts]       = useState(false)
  const [catalogActive,    setCatalogActive]     = useState(false)
  const [catalogSlug,      setCatalogSlug]       = useState<string | null>(null)
  const [catalogShared,    setCatalogShared]     = useState(false)

  const fetchOperativo = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/charts?period=7d')
      if (res.ok) {
        const data = await res.json() as ChartsMin
        setLowStock(data.low_stock_count ?? 0)
      }
    } catch { /* non-critical */ }
  }, [])

  const fetchAnalytics = useCallback(async (p: Period) => {
    setLoading(true)
    const { from, to } = getRange(p)
    const qs = `from=${from}&to=${to}`
    try {
      const [sumRes, prodRes] = await Promise.all([
        fetch(`/api/analytics/summary?${qs}`),
        fetch(`/api/analytics/top-products?${qs}&limit=5`),
      ])
      if (sumRes.ok)  setSummary(await sumRes.json() as AnalyticsSummary)
      if (prodRes.ok) {
        const j = await prodRes.json() as { products: TopProduct[] }
        setProducts(j.products ?? [])
      }
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [])

  /* Fetch credit pending — outstanding balance, runs once on mount */
  useEffect(() => {
    fetch('/api/dashboard/credit-summary')
      .then(r => r.ok ? r.json() : null)
      .then((j: { ok: boolean; total_usd: number; count: number } | null) => {
        if (j?.ok) setCreditData({ total: j.total_usd, count: j.count })
      })
      .catch(() => {})
  }, [])

  /* Fetch today's summary for the day card — runs once on mount */
  useEffect(() => {
    const { from, to } = getRange('hoy')
    fetch(`/api/analytics/summary?from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: AnalyticsSummary | null) => {
        if (j?.ok) {
          setTodayVentas({
            totalUsd: j.ventas.total_usd,
            utilidad: j.resultado?.utilidad_neta_usd ?? 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { void fetchOperativo() }, [fetchOperativo])
  useEffect(() => { void fetchAnalytics(period) }, [fetchAnalytics, period])

  /* Checklist de bienvenida — solo se resuelve si el usuario no lo ocultó antes */
  useEffect(() => {
    if (localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true') return
    setCatalogShared(localStorage.getItem(CATALOG_SHARED_KEY) === 'true')

    Promise.all([
      fetch('/api/config/business').then(r => r.ok ? r.json() : null),
      fetch('/api/config/catalog').then(r => r.ok ? r.json() : null),
      fetch('/api/products').then(r => r.ok ? r.json() : null),
    ]).then(([bizJson, catJson, prodJson]: [
      { ok: boolean; business?: { created_at: string; logo_path: string | null; catalog_active: boolean } } | null,
      { ok: boolean; catalog_slug?: string | null } | null,
      { ok: boolean; products?: unknown[] } | null,
    ]) => {
      if (bizJson?.ok && bizJson.business) {
        const b = bizJson.business
        const daysSince = (Date.now() - new Date(b.created_at).getTime()) / 86_400_000
        setIsNewTenant(daysSince < NEW_TENANT_WINDOW_DAYS)
        setHasLogo(b.logo_path !== null)
        setCatalogActive(b.catalog_active)
        setWelcomeDismissed(false)
      }
      if (catJson?.ok) setCatalogSlug(catJson.catalog_slug ?? null)
      if (prodJson?.ok) setHasProducts((prodJson.products?.length ?? 0) > 0)
    }).catch(() => {})
  }, [])

  function dismissWelcome() {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true')
    setWelcomeDismissed(true)
  }

  function handleShareCatalog() {
    if (!catalogSlug) return
    const url = `${window.location.origin}/catalogo/${catalogSlug}`
    void navigator.clipboard.writeText(url)
    localStorage.setItem(CATALOG_SHARED_KEY, 'true')
    setCatalogShared(true)
  }

  const welcomeSteps: WelcomeStep[] = [
    { key: 'cuenta',   label: 'Crea tu cuenta',              done: true },
    { key: 'logo',     label: 'Sube tu logo',                done: hasLogo,       href: '/configuracion' },
    { key: 'producto', label: 'Crea tu primer producto',     done: hasProducts,   href: '/productos' },
    { key: 'catalogo', label: 'Activa tu catálogo',          done: catalogActive, href: '/catalogo-digital' },
    { key: 'compartir', label: 'Comparte tu link de ventas', done: catalogShared, onAction: handleShareCatalog },
  ]
  const showWelcome = isNewTenant && !welcomeDismissed

  /* Gastos próximos a vencer — alert banner */
  useEffect(() => {
    fetch('/api/gastos/alerts')
      .then(r => r.ok ? r.json() : null)
      .then((j: { ok?: boolean; alerts?: Array<{ id: number }> } | null) => {
        const count = j?.alerts?.length ?? 0
        if (count > 0) setGastosAlert({ count })
      })
      .catch(() => {})
  }, [])

  const dateStr = new Date().toLocaleDateString('es-VE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const v            = summary?.ventas
  const delta        = summary?.vs_anterior?.variacion_pct ?? 0
  const maxQty       = Math.max(...products.map(p => p.qty_sold), 1)
  const utilityNeta  = summary?.resultado?.utilidad_neta_usd ?? 0
  const utilityIsNeg = !loading && utilityNeta < 0

  const todayMargen = todayVentas && todayVentas.totalUsd > 0
    ? (todayVentas.utilidad / todayVentas.totalUsd) * 100
    : 0

  return (
    <div className={`${styles.page} page-container`}>

      <DashboardReportAlert />

      {/* ── Bienvenida (solo tenants nuevos, no descartada) ── */}
      {showWelcome && (
        <div className={styles.welcomeCard}>
          <button
            type="button"
            className={styles.welcomeDismiss}
            onClick={dismissWelcome}
            aria-label="Ocultar bienvenida"
          >
            <X size={14} aria-hidden="true" />
          </button>

          <div className={styles.welcomeHead}>
            <PartyPopper size={20} className={styles.welcomeIcon} aria-hidden="true" />
            <div>
              <p className={styles.welcomeTitle}>¡Bienvenido a ActivoPOS!</p>
              <p className={styles.welcomeSubtitle}>Completa estos pasos para empezar:</p>
            </div>
          </div>

          <ul className={styles.welcomeList} role="list">
            {welcomeSteps.map((step, i) => {
              const content = (
                <>
                  {step.done
                    ? <Check size={15} className={styles.welcomeStepIconDone} aria-hidden="true" />
                    : <Circle size={15} className={styles.welcomeStepIconTodo} aria-hidden="true" />}
                  <span className={step.done ? styles.welcomeStepLabelDone : styles.welcomeStepLabel}>
                    {step.label}
                  </span>
                  {step.key === 'compartir' && !step.done && <Copy size={13} className={styles.welcomeStepCopyIcon} aria-hidden="true" />}
                </>
              )
              const itemStyle = { animationDelay: `${i * 60}ms` }

              if (step.done) {
                return (
                  <li key={step.key} className={styles.welcomeStep} style={itemStyle}>{content}</li>
                )
              }
              if (step.href) {
                return (
                  <li key={step.key} style={itemStyle}>
                    <Link href={step.href} className={styles.welcomeStep}>{content}</Link>
                  </li>
                )
              }
              return (
                <li key={step.key} style={itemStyle}>
                  <button type="button" className={styles.welcomeStepBtn} onClick={step.onAction}>{content}</button>
                </li>
              )
            })}
          </ul>

          <button type="button" className={styles.welcomeHideLink} onClick={dismissWelcome}>
            Ocultar esto
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.brandMark} aria-hidden="true">
            <img src="/activopos-3d.svg" alt="" className={styles.brandMarkLogo} />
            <span className={styles.brandMarkName}>
              <span className={styles.brandMarkActivo}>Activo</span>
              <span className={styles.brandMarkPOS}>POS</span>
            </span>
          </div>
          <h2 className={styles.greeting}>{getGreeting()}</h2>
          <p className={styles.subtitle}>{dateStr}</p>
        </div>
        <div className={styles.periodTabs} role="tablist" aria-label="Período de análisis">
          {PERIODS.map(p => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              className={`${styles.periodTab} ${period === p.key ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Acciones rápidas ── */}
      <div className={styles.quickActions}>
        <Link href="/pos" className={`${styles.quickActionBtn} ${styles.quickActionPrimary}`}>
          <Plus size={15} aria-hidden="true" />
          Nueva venta
        </Link>
        <Link href="/finanzas" className={styles.quickActionBtn}>
          <Receipt size={15} aria-hidden="true" />
          Agregar gasto
        </Link>
        <Link href="/proveedores/compras" className={styles.quickActionBtn}>
          <Truck size={15} aria-hidden="true" />
          Nueva compra
        </Link>
      </div>

      {/* ── Alerta gastos por vencer ── */}
      {gastosAlert && gastosAlert.count > 0 && (
        <div className={styles.gastosAlertBanner} role="alert">
          <TriangleAlert size={16} className={styles.gastosAlertIcon} aria-hidden="true" />
          <span>
            Tienes <strong>{gastosAlert.count}</strong>{' '}
            {gastosAlert.count === 1 ? 'gasto fijo por vencer' : 'gastos fijos por vencer'}{' '}
            esta semana.
          </span>
          <Link href="/finanzas" className={styles.gastosAlertLink}>
            Ver Finanzas
          </Link>
        </div>
      )}

      {/* ── KPI grid — asimétrico, íconos en círculos de color ── */}
      <div className={styles.kpiGrid}>

        {/* KPI 1 — Cobrado (hero) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCobrado}`}
          aria-busy={loading}
          aria-label="Cobrado"
        >
          <div className={`${styles.kpiIconCircle} ${styles.kpiCircleGreen}`} aria-hidden="true">
            <DollarSign size={18} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Cobrado</span>
            {loading ? (
              <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
            ) : (
              <>
                <span className={styles.kpiValue}>{fmtUsd(v?.total_usd ?? 0)}</span>
                <span className={styles.kpiSub}>{fmtBsVal(v?.total_bs ?? 0)}</span>
                <DeltaBadge pct={delta} />
              </>
            )}
          </div>
        </div>

        {/* KPI 2 — Crédito pendiente (all-time outstanding) */}
        <div className={`${styles.kpiCard} ${styles.kpiCredito}`} aria-label="Crédito pendiente">
          <div className={`${styles.kpiIconCircle} ${styles.kpiCircleOrange}`} aria-hidden="true">
            <Clock size={18} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Crédito pendiente</span>
            {creditData === null ? (
              <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
            ) : (
              <>
                <span className={styles.kpiValue}>{fmtUsd(creditData.total)}</span>
                <span className={styles.kpiSub}>
                  {creditData.count}&nbsp;
                  {creditData.count === 1 ? 'venta' : 'ventas'} a cobrar
                </span>
              </>
            )}
          </div>
        </div>

        {/* KPI 3 — Tickets cobrados */}
        <div className={`${styles.kpiCard} ${styles.kpiTickets}`} aria-busy={loading} aria-label="Tickets cobrados">
          <div className={`${styles.kpiIconCircle} ${styles.kpiCircleBlue}`} aria-hidden="true">
            <ShoppingCart size={18} />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Tickets cobrados</span>
            {loading ? (
              <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
            ) : (
              <>
                <span className={styles.kpiValue}>{fmtNum(v?.count ?? 0)}</span>
                <span className={styles.kpiSub}>transacciones pagadas</span>
              </>
            )}
          </div>
        </div>

        {/* KPI 4 — Utilidad neta (ancha) */}
        <div className={`${styles.kpiCard} ${styles.kpiUtilidad}`} aria-busy={loading} aria-label="Utilidad neta">
          <div
            className={`${styles.kpiIconCircle} ${utilityIsNeg ? styles.kpiCircleRed : styles.kpiCirclePurple}`}
            aria-hidden="true"
          >
            {utilityIsNeg ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Utilidad neta</span>
            {loading ? (
              <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
            ) : (
              <>
                <span className={styles.kpiValue}>
                  {fmtUsd(summary?.resultado?.utilidad_neta_usd ?? 0)}
                </span>
                <span className={styles.kpiSub}>
                  {v && v.total_usd > 0
                    ? `${(((summary?.resultado?.utilidad_neta_usd ?? 0) / v.total_usd) * 100).toFixed(1)}% margen`
                    : 'sin ventas'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Resumen del día — solo cuando el período activo es "Hoy": el mensaje
          usa new Date() (hoy), mostrarlo con otro período activo (7 días/mes/
          trimestre) lo desincroniza visualmente del resto del dashboard ── */}
      {period === 'hoy' && todayVentas !== null && (
        <div className={styles.daySummary} aria-label="Resumen del día">
          <span className={styles.daySummaryText}>
            Vendiste&nbsp;<strong>{fmtUsd(todayVentas.totalUsd)}</strong>&nbsp;hoy
            {todayVentas.utilidad !== 0 && (
              <>
                &nbsp;·&nbsp;Utilidad:&nbsp;
                <strong className={todayVentas.utilidad >= 0 ? styles.daySummaryPos : styles.daySummaryNeg}>
                  {fmtUsd(todayVentas.utilidad)}
                </strong>
                &nbsp;·&nbsp;Margen:&nbsp;
                <strong className={todayVentas.utilidad >= 0 ? styles.daySummaryPos : styles.daySummaryNeg}>
                  {todayMargen.toFixed(1)}%
                </strong>
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Row 2: alerta + top productos ── */}
      <div className={styles.row2}>

        {/* Alerta inventario */}
        <div className={`${styles.sectionCard} ${styles.alertBorder}`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Inventario bajo</span>
            <Link href="/productos" className={styles.sectionLink}>
              Ver todos
            </Link>
          </div>
          <div className={styles.alertContent}>
            <div className={styles.alertIconWrap}>
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <div className={styles.alertText}>
              {lowStock === null ? (
                <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
              ) : lowStock > 0 ? (
                <span className={styles.alertCriticalBadge}>
                  {lowStock} producto{lowStock !== 1 ? 's' : ''} crítico{lowStock !== 1 ? 's' : ''}
                </span>
              ) : (
                <p className={`${styles.alertLabel} ${styles.alertOk}`}>
                  Sin alertas de inventario
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Top productos */}
        <div className={`${styles.sectionCard} ${styles.positiveBorder}`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Top productos</span>
            <Link href="/reportes" className={styles.sectionLink}>
              Ver reporte
            </Link>
          </div>
          {loading ? (
            <div className={styles.prodList}>
              {[0, 1, 2].map(i => (
                <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className={styles.emptyState}>Sin ventas en este período</p>
          ) : (
            <div className={styles.prodList}>
              {products.map((p, i) => (
                <div key={p.id} className={styles.prodItem}>
                  <span className={styles.prodRank}>{i + 1}</span>
                  <div className={styles.prodBar}>
                    <span className={styles.prodName}>{p.name}</span>
                    <div className={styles.prodBarTrack}>
                      <div
                        className={styles.prodBarFill}
                        style={{ width: `${(p.qty_sold / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className={styles.prodQty}>{p.qty_sold} uds.</span>
                  <span className={`${styles.prodTrend} ${
                    p.trend === 'up'   ? styles.trendUp   :
                    p.trend === 'down' ? styles.trendDown : styles.trendFlat
                  }`}>
                    {p.trend === 'up'   && <ArrowUp size={12} aria-hidden="true" />}
                    {p.trend === 'down' && <ArrowDown size={12} aria-hidden="true" />}
                    {p.trend === 'flat' && <Minus size={12} aria-hidden="true" />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Métodos de pago ── */}
      {!loading && summary?.por_metodo && summary.por_metodo.length > 0 && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Métodos de pago</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Transacciones</th>
                  <th>Total USD</th>
                </tr>
              </thead>
              <tbody>
                {summary.por_metodo.map(m => (
                  <tr key={m.method_name}>
                    <td className={styles.tdPrimary}>
                      {METODO_LABELS[m.method_name] ?? m.method_name}
                    </td>
                    <td>{m.count}</td>
                    <td className={styles.tdBrand}>{fmtUsd(m.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className={styles.ctaRow}>
        <div className={styles.ctaText}>
          <span className={styles.ctaTitle}>¿Listo para vender?</span>
          <span className={styles.ctaSub}>Abre el POS y registra tus ventas del día.</span>
        </div>
        <Link href="/pos" className={styles.ctaBtn}>
          <ShoppingBag size={16} aria-hidden="true" />
          Ir al POS
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

    </div>
  )
}

/* ── Helper components ── */

function DeltaBadge({ pct }: { pct: number }) {
  if (pct > 0) {
    return (
      <span className={`${styles.kpiTrend} ${styles.kpiTrendUp}`}>
        <ArrowUp size={10} strokeWidth={2.5} aria-hidden="true" />
        {pct.toFixed(1)}%
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span className={`${styles.kpiTrend} ${styles.kpiTrendDown}`}>
        <ArrowDown size={10} strokeWidth={2.5} aria-hidden="true" />
        {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className={`${styles.kpiTrend} ${styles.kpiTrendFlat}`}>
      <Minus size={10} strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}
