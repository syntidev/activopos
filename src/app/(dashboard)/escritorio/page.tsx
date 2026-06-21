'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react'
import styles from './escritorio.module.css'

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
    metodo:    string
    total_usd: number
    count:     number
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
  const [period,   setPeriod]   = useState<Period>('7dias')
  const [summary,  setSummary]  = useState<AnalyticsSummary | null>(null)
  const [products, setProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<number | null>(null)
  const [loading,  setLoading]  = useState(true)

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

  useEffect(() => { void fetchOperativo() }, [fetchOperativo])
  useEffect(() => { void fetchAnalytics(period) }, [fetchAnalytics, period])

  const dateStr = new Date().toLocaleDateString('es-VE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const v        = summary?.ventas
  const delta    = summary?.vs_anterior?.variacion_pct ?? 0
  const maxQty   = Math.max(...products.map(p => p.qty_sold), 1)

  return (
    <div className={`${styles.page} page-container`}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
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

      {/* ── KPI grid ── */}
      <div className={styles.kpiGrid}>

        {/* KPI 1 — Facturación (teal primary) */}
        <div
          className={`${styles.kpiCardColor} ${styles.kpiPrimary}`}
          aria-busy={loading}
          aria-label="Facturación total"
        >
          <DollarSign size={48} className={styles.kpiBgIcon} aria-hidden="true" />
          <span className={styles.kpiColorLabel}>Facturación</span>
          {loading ? (
            <div className={`${styles.skeletonKpiVal} ${styles.skeletonOnColor}`} />
          ) : (
            <>
              <span className={styles.kpiColorValue}>{fmtUsd(v?.total_usd ?? 0)}</span>
              <span className={styles.kpiColorSub}>{fmtBsVal(v?.total_bs ?? 0)}</span>
              <DeltaBadge pct={delta} colored />
            </>
          )}
        </div>

        {/* KPI 2 — Ticket promedio (white) */}
        <div className={styles.kpiCardWhite} aria-busy={loading} aria-label="Ticket promedio">
          <div className={styles.kpiWhiteHead}>
            <span className={styles.kpiWhiteLabel}>Ticket Prom.</span>
            <TrendingUp size={16} className={styles.kpiWhiteIcon} aria-hidden="true" />
          </div>
          {loading ? (
            <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
          ) : (
            <>
              <span className={styles.kpiWhiteValue}>{fmtUsd(v?.avg_ticket_usd ?? 0)}</span>
              <span className={styles.kpiWhiteSub}>por transacción</span>
            </>
          )}
        </div>

        {/* KPI 3 — Órdenes (white) */}
        <div className={styles.kpiCardWhite} aria-busy={loading} aria-label="Órdenes cobradas">
          <div className={styles.kpiWhiteHead}>
            <span className={styles.kpiWhiteLabel}>Órdenes</span>
            <ShoppingCart size={16} className={styles.kpiWhiteIcon} aria-hidden="true" />
          </div>
          {loading ? (
            <div className={`${styles.skeleton} ${styles.skeletonKpiVal}`} />
          ) : (
            <>
              <span className={styles.kpiWhiteValue}>{fmtNum(v?.count ?? 0)}</span>
              <span className={styles.kpiWhiteSub}>transacciones cobradas</span>
            </>
          )}
        </div>

        {/* KPI 4 — Utilidad neta (teal secondary) */}
        <div
          className={`${styles.kpiCardColor} ${styles.kpiSecondary}`}
          aria-busy={loading}
          aria-label="Utilidad neta"
        >
          <TrendingUp size={48} className={styles.kpiBgIcon} aria-hidden="true" />
          <span className={styles.kpiColorLabel}>Utilidad neta</span>
          {loading ? (
            <div className={`${styles.skeletonKpiVal} ${styles.skeletonOnColor}`} />
          ) : (
            <>
              <span className={styles.kpiColorValue}>
                {fmtUsd(summary?.resultado?.utilidad_neta_usd ?? 0)}
              </span>
              <span className={styles.kpiColorSub}>
                {v && v.total_usd > 0
                  ? `${(((summary?.resultado?.utilidad_neta_usd ?? 0) / v.total_usd) * 100).toFixed(1)}% margen`
                  : 'sin ventas'}
              </span>
            </>
          )}
        </div>
      </div>

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
                <>
                  <p className={styles.alertCount}>{lowStock}</p>
                  <p className={styles.alertLabel}>
                    producto{lowStock !== 1 ? 's' : ''} con stock crítico
                  </p>
                </>
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
                  <tr key={m.metodo}>
                    <td className={styles.tdPrimary}>
                      {METODO_LABELS[m.metodo] ?? m.metodo}
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

function DeltaBadge({ pct, colored }: { pct: number; colored?: boolean }) {
  if (pct > 0) {
    return (
      <span className={colored ? styles.kpiColorDelta : `${styles.kpiTrend} ${styles.kpiTrendUp}`}>
        <ArrowUp size={10} strokeWidth={2.5} aria-hidden="true" />
        {pct.toFixed(1)}%
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span className={colored ? styles.kpiColorDelta : `${styles.kpiTrend} ${styles.kpiTrendDown}`}>
        <ArrowDown size={10} strokeWidth={2.5} aria-hidden="true" />
        {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className={colored ? styles.kpiColorDelta : `${styles.kpiTrend} ${styles.kpiTrendFlat}`}>
      <Minus size={10} strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}
