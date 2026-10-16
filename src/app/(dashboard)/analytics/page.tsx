'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts'
import type { SummaryData, TopProductsData, TrendsData, PeriodType } from '@/types/analytics'
import styles from './analytics.module.css'
import { businessDateKey, businessMonthKey, shiftDateKey } from '@/lib/business-day'

/* ── Helpers ─────────────────────────────────────────────── */

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-VE', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  })
}

function fmtHour(h: number): string {
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:00 ${suffix}`
}

function getPeriodRange(period: PeriodType): { from: string; to: string } {
  const today = businessDateKey()

  if (period === 'week') {
    const dow  = new Date(`${today}T00:00:00Z`).getUTCDay()
    const from = shiftDateKey(today, -(dow === 0 ? 6 : dow - 1))
    return { from, to: shiftDateKey(from, 7) }
  }
  if (period === 'quarter') {
    const [yyyy, mm] = today.split('-').map(Number)
    const q    = Math.floor((mm - 1) / 3)
    const pad  = (x: number) => String(x).padStart(2, '0')
    return {
      from: `${yyyy}-${pad(q * 3 + 1)}-01`,
      to:   q === 3 ? `${yyyy + 1}-01-01` : `${yyyy}-${pad(q * 3 + 4)}-01`,
    }
  }
  return {
    from: `${businessMonthKey()}-01`,
    to:   `${businessMonthKey(new Date(), -1)}-01`,
  }
}

/* ── Sub-components ──────────────────────────────────────── */

function TrendBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 2) return <span className={styles.trendStable}>→ Estable</span>
  return pct > 0
    ? <span className={styles.trendUp}>↑ {pct.toFixed(1)}%</span>
    : <span className={styles.trendDown}>↓ {Math.abs(pct).toFixed(1)}%</span>
}

function RowTrend({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')   return <span className={styles.rowTrendUp}>↑</span>
  if (trend === 'down') return <span className={styles.rowTrendDown}>↓</span>
  return <span className={styles.rowTrendStable}>→</span>
}

/* ── Constants ───────────────────────────────────────────── */

const PERIOD_LABELS: Record<PeriodType, string> = {
  week:    'Semana',
  month:   'Mes',
  quarter: 'Trimestre',
}

const PERIODS: PeriodType[] = ['week', 'month', 'quarter']

/* ── Page ────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [period,      setPeriod]      = useState<PeriodType>('month')
  const [summary,     setSummary]     = useState<SummaryData | null>(null)
  const [topProducts, setTopProducts] = useState<TopProductsData | null>(null)
  const [trends,      setTrends]      = useState<TrendsData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)

  const load = useCallback(async (p: PeriodType, signal: AbortSignal) => {
    setLoading(true)
    setError(false)
    const { from, to } = getPeriodRange(p)

    try {
      const [summaryRes, topRes, trendsRes] = await Promise.all([
        fetch(`/api/analytics/summary?from=${from}&to=${to}`, { signal }),
        fetch(`/api/analytics/top-products?from=${from}&to=${to}&limit=8`, { signal }),
        fetch(`/api/analytics/trends?period=${p}`, { signal }),
      ])

      if (!summaryRes.ok || !topRes.ok || !trendsRes.ok) throw new Error('HTTP error')

      const [sRaw, tpRaw, trRaw] = await Promise.all([
        summaryRes.json(),
        topRes.json(),
        trendsRes.json(),
      ])

      const sJson  = sRaw  as SummaryData
      const tpJson = tpRaw as TopProductsData
      const trJson = trRaw as TrendsData

      if (sJson.ok)  setSummary(sJson)
      if (tpJson.ok) setTopProducts(tpJson)
      if (trJson.ok) setTrends(trJson)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(period, ctrl.signal)
    return () => ctrl.abort()
  }, [period, load])

  if (loading) return <div className={styles.loading}>Cargando analíticas…</div>
  if (error)   return <div className={styles.loading}>Error al cargar los datos. Intenta de nuevo.</div>
  if (!summary || !topProducts || !trends) return <div className={styles.loading}>Sin datos disponibles.</div>

  const { ventas, vs_anterior, por_metodo, mejor_dia, mejor_hora } = summary

  return (
    <div className={`${styles.page} page-container`}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Pulso del Negocio</h1>
        <div className={styles.periodTabs} role="tablist" aria-label="Período">
          {PERIODS.map(p => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              className={`${styles.periodTab} ${period === p ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div className={styles.kpiGrid}>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ventas</span>
          <span className={styles.kpiValue}>{fmtUsd(ventas.total_usd)}</span>
          {ventas.total_bs > 0 && (
            <span className={styles.kpiSub}>
              Bs. {ventas.total_bs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Tickets</span>
          <span className={styles.kpiValue}>{ventas.count}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ticket promedio</span>
          <span className={styles.kpiValue}>{fmtUsd(ventas.avg_ticket_usd)}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Items vendidos</span>
          <span className={styles.kpiValue}>{ventas.items_sold}</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>vs período anterior</span>
          <TrendBadge pct={vs_anterior.variacion_pct} />
          <span className={styles.kpiSub}>{fmtUsd(vs_anterior.total_usd)} anterior</span>
        </div>

      </div>

      {/* ── Trends chart ── */}
      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Tendencia de ventas</h2>
        {trends.data.length === 0 ? (
          <div className={styles.chartEmpty}>Sin ventas en este período</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={trends.data}
                margin={{ top: 4, right: 4, bottom: 0, left: 8 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${Number(v)}`}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ChartTooltip
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : parseFloat(String(value))
                    return [`$${isFinite(n) ? n.toFixed(2) : '0.00'}`, 'Ventas']
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total_usd"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-brand)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Bottom grid ── */}
      <div className={styles.bottomGrid}>

        {/* Top productos */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Productos más vendidos</h2>
          {topProducts.products.length === 0 ? (
            <p className={styles.payEmpty}>Sin ventas en este período</p>
          ) : (
            <table className={styles.topTable}>
              <thead>
                <tr>
                  <th className={styles.topTh}>Producto</th>
                  <th className={`${styles.topTh} ${styles.right}`}>Qty</th>
                  <th className={`${styles.topTh} ${styles.right}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.products.map(p => (
                  <tr key={p.id} className={styles.topTr}>
                    <td className={styles.topTd}>
                      <div className={styles.productRow}>
                        <RowTrend trend={p.trend} />
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className={`${styles.topTd} ${styles.right}`}>×{p.qty_sold}</td>
                    <td className={`${styles.topTd} ${styles.right}`}>{fmtUsd(p.total_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Por método de pago */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Por método de pago</h2>
          {por_metodo.length === 0 ? (
            <p className={styles.payEmpty}>Sin datos de pago en este período</p>
          ) : (
            <div className={styles.payList}>
              {por_metodo.map(m => (
                <div key={m.method_name} className={styles.payRow}>
                  <div className={styles.payMeta}>
                    <span className={styles.payName}>{m.method_name}</span>
                    <span className={styles.payPct}>
                      {m.pct.toFixed(1)}% · {fmtUsd(m.total_usd)}
                    </span>
                  </div>
                  <div className={styles.payBarWrap}>
                    <div className={styles.payBarFill} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Insights ── */}
      {(mejor_dia ?? mejor_hora) && (
        <div className={styles.insights}>
          {mejor_dia && (
            <div className={styles.insightItem}>
              <span className={styles.insightLabel}>Mejor día:</span>
              <span className={styles.insightValue}>
                {fmtDate(mejor_dia.date)} — {fmtUsd(mejor_dia.total_usd)}
              </span>
            </div>
          )}
          {mejor_hora && (
            <div className={styles.insightItem}>
              <span className={styles.insightLabel}>Mejor hora:</span>
              <span className={styles.insightValue}>
                {fmtHour(mejor_hora.hour)} — {fmtUsd(mejor_hora.avg_usd)}/tx
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
