'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line,
} from 'recharts'
import styles from './finanzas.module.css'

interface ER {
  ventas_netas:      number
  costo_ventas:      number
  utilidad_bruta:    number
  margen_bruto_pct:  number
  gastos_operativos: number
  utilidad_neta:     number
  margen_neto_pct:   number
}

interface ResumenData {
  ingresos_totales:  { usd: number; bs: number }
  gastos_totales:    { usd: number }
  estado_resultados: ER
  insight:           string
}

interface Props { month: string; rate: number }

const fmtUsd = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number, rate: number) =>
  `Bs. ${(n * rate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtPct = (n: number) => `${n.toFixed(1)}%`

function safePct(value: number, base: number, decimals = 1): string {
  if (!base || base === 0) return '—'
  const pct = (value / base) * 100
  if (!isFinite(pct)) return '—'
  if (Math.abs(pct) > 999) return pct > 0 ? '>999%' : '<-999%'
  return `${pct.toFixed(decimals)}%`
}

/* ── Punto de Equilibrio: datos del servidor (no del reloj del navegador) ── */

interface PEResponse {
  ok:                      boolean
  period_label:            string
  ventas_usd:              number
  gastos_fijos_usd:        number
  margen_contribucion_pct: number
  punto_equilibrio_usd:    number | null
  superado:                boolean
  progreso_pct:            number
  faltante_usd:            number | null
  excedente_usd:           number | null
  sin_margen:              boolean
  mensaje:                 string | null
  dias_transcurridos:      number
  dias_totales:            number
  proyeccion_fin_mes_usd:  number
  alcanzara_pe:            boolean
}

function PuntoEquilibrioCard({ month }: { month: string }) {
  const [pe,      setPe]      = useState<PEResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setPe(null); setError(false)
    fetch(`/api/finanzas/punto-equilibrio?month=${month}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((j: PEResponse) => { if (j.ok) setPe(j); else setError(true) })
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setError(true) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [month])

  if (loading) {
    return (
      <div className={styles.peCard}>
        <div className={styles.peContent}>
          <p className={styles.peCaption}>Calculando punto de equilibrio…</p>
        </div>
      </div>
    )
  }
  if (error || !pe) return null

  // Margen negativo/cero — el endpoint ya trae el mensaje
  if (pe.sin_margen) {
    return (
      <div className={styles.peCard}>
        <div className={`${styles.peStatusRow} ${styles.peStatusRisk}`}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{pe.mensaje ?? 'El costo de ventas supera los ingresos — revisa tus precios'}</span>
        </div>
      </div>
    )
  }

  // Sin datos suficientes — muestra el mensaje del servidor (ej. "Sin ventas
  // registradas en este período"), no inventa un número.
  if (pe.punto_equilibrio_usd === null) {
    return (
      <div className={styles.peCard}>
        <div className={styles.peContent}>
          <p className={styles.peCaption}>{pe.mensaje ?? 'Sin datos suficientes para calcular'}</p>
        </div>
      </div>
    )
  }

  const status: 'success' | 'progress' | 'risk' =
    pe.superado ? 'success' : pe.alcanzara_pe ? 'progress' : 'risk'
  const peBarClass =
    status === 'success'  ? styles.peBarSuccess  :
    status === 'progress' ? styles.peBarProgress :
    styles.peBarRisk
  const peStatusClass =
    status === 'success'  ? styles.peStatusSuccess  :
    status === 'progress' ? styles.peStatusProgress :
    styles.peStatusRisk

  return (
    <div className={styles.peCard}>
      <svg className={styles.peSvgBg} viewBox="0 0 120 80" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="55" x2="120" y2="55" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <line x1="0" y1="80" x2="120" y2="0" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="82" cy="19" r="3" fill="currentColor"/>
      </svg>
      <div className={styles.peContent}>
        <h3 className={styles.peTitle}>Punto de Equilibrio — {pe.period_label}</h3>

        <div className={styles.peStatsRow}>
          <div className={styles.peStat}>
            <span className={styles.peStatLabel}>Gastos fijos</span>
            <span className={styles.peStatValue}>{fmtUsd(pe.gastos_fijos_usd)}</span>
          </div>
          <div className={styles.peStat}>
            <span className={styles.peStatLabel}>Margen contribución</span>
            <span className={styles.peStatValue}>{fmtPct(pe.margen_contribucion_pct)}</span>
          </div>
          <div className={styles.peStat}>
            <span className={styles.peStatLabel}>Punto de equilibrio</span>
            <span className={styles.peStatValue}>{fmtUsd(pe.punto_equilibrio_usd)}</span>
          </div>
        </div>

        <div className={styles.peBar}>
          <div className={`${styles.peBarFill} ${peBarClass}`} style={{ width: `${pe.progreso_pct}%` }} />
        </div>

        <p className={styles.peCaption}>
          Ventas actuales: {fmtUsd(pe.ventas_usd)} / PE: {fmtUsd(pe.punto_equilibrio_usd)}
          {' '}· Día {pe.dias_transcurridos} de {pe.dias_totales}
          {' '}· Proyección: {fmtUsd(pe.proyeccion_fin_mes_usd)}
        </p>

        <div className={`${styles.peStatusRow} ${peStatusClass}`}>
          {status === 'success' && (
            <><CheckCircle size={14} aria-hidden="true" /> Superado — Excedente: {fmtUsd(pe.excedente_usd ?? 0)}</>
          )}
          {status === 'progress' && (
            <><Clock size={14} aria-hidden="true" /> En progreso — Faltan {fmtUsd(pe.faltante_usd ?? 0)} para cubrir gastos</>
          )}
          {status === 'risk' && (
            <><AlertTriangle size={14} aria-hidden="true" /> En riesgo — Proyección ({fmtUsd(pe.proyeccion_fin_mes_usd)}) no alcanza el PE</>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Gráfico de utilidad diaria ── */

interface DailyPoint {
  date:      string
  ingresos:  number
  gastos:    number
  utilidad:  number
}

interface DailyPayloadEntry {
  name:    string
  value:   number
  dataKey: string
}

function DailyTrendCard({ month }: { month: string }) {
  const [points,  setPoints]  = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [empty,   setEmpty]   = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setEmpty(false)
    fetch(`/api/finanzas/daily?month=${month}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then((j: { ok: boolean; points?: DailyPoint[] }) => {
        if (j.ok && j.points && j.points.length > 0) {
          setPoints(j.points)
        } else {
          setEmpty(true)
        }
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setEmpty(true)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [month])

  if (loading) return null

  const fmtDay = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short',
    })

  const DailyTooltip = ({
    active, payload, label,
  }: { active?: boolean; payload?: DailyPayloadEntry[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.chartTooltipLabel}>{label ? fmtDay(label) : ''}</p>
        {payload.map((p, i) => (
          <p key={i} className={styles.chartTooltipValue}>
            {p.name}: {fmtUsd(p.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>Utilidad del período</h3>
      {empty ? (
        <p className={styles.chartCaption}>Sin datos para el período</p>
      ) : (
        <>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDay}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000
                      ? `$${(v / 1000).toFixed(0)}k`
                      : `$${v.toFixed(0)}`
                  }
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar
                  dataKey="ingresos"
                  name="Ingresos"
                  fill="var(--color-brand)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="gastos"
                  name="Gastos"
                  fill="var(--danger)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Line
                  dataKey="utilidad"
                  name="Utilidad"
                  stroke="var(--color-success-text)"
                  strokeWidth={2}
                  dot={false}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.chartCaption}>
            Azul: Ingresos · Rojo: Gastos · Verde: Utilidad neta
          </p>
        </>
      )}
    </div>
  )
}

/* ── CLI-A: implementar GET /api/finanzas/daily?month=YYYY-MM ── */
/* Respuesta esperada: { ok: true, points: [{ date, ingresos, gastos, utilidad }] } */

export function ResumenSection({ month, rate }: Props) {
  const [data,    setData]    = useState<ResumenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setData(null); setError(false)
    fetch(`/api/finanzas/resumen?month=${month}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((j: { ok: boolean } & ResumenData) => { if (j.ok) setData(j); else setError(true) })
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setError(true) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [month])

  if (loading) return <div className={styles.loading}>Cargando resumen financiero…</div>
  if (error)   return <div className={styles.loading}>Error al cargar el resumen. Intenta de nuevo.</div>
  if (!data)   return <div className={styles.loading}>Sin datos para este período.</div>

  const er     = data.estado_resultados
  const isPos  = er.utilidad_neta >= 0

  const chartData = [
    { name: 'Ingresos', value: er.ventas_netas,          key: 'income'  },
    { name: 'Gastos',   value: er.gastos_operativos,      key: 'expense' },
    { name: 'Utilidad', value: Math.abs(er.utilidad_neta), key: isPos ? 'profit' : 'loss' },
  ]

  const CHART_COLORS: Record<string, string> = {
    income:  'var(--color-brand)',
    expense: 'var(--danger)',
    profit:  'var(--color-success-text)',
    loss:    'var(--danger)',
  }

  interface TooltipPayload {
    payload?: { name: string; value: number }
    value?: number
  }

  const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.chartTooltipLabel}>{item.payload?.name ?? ''}</p>
        <p className={styles.chartTooltipValue}>{fmtUsd(item.payload?.value ?? 0)}</p>
      </div>
    )
  }

  /* P&L bars — proportional to ventas_netas */
  const barW = (n: number) =>
    er.ventas_netas > 0 ? `${Math.min((Math.abs(n) / er.ventas_netas) * 100, 100)}%` : '0%'

  return (
    <>
      {/* ── KPIs ── */}
      <div className={styles.kpiGrid}>

        <div className={styles.kpiCard}>
          <TrendingUp size={16} className={`${styles.kpiIcon} ${styles.kpiIconBrand}`} aria-hidden="true" />
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Ventas</span>
            <span className={styles.kpiPrimary}>{fmtUsd(er.ventas_netas)}</span>
            <span className={styles.kpiSub2}>{data.ingresos_totales.bs > 0
              ? `Bs. ${data.ingresos_totales.bs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
              : fmtBs(er.ventas_netas, rate)}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <DollarSign size={16} className={`${styles.kpiIcon} ${styles.kpiIconMuted}`} aria-hidden="true" />
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Gastos</span>
            <span className={styles.kpiPrimary}>{fmtUsd(er.gastos_operativos)}</span>
            <span className={styles.kpiSub2}>{fmtBs(er.gastos_operativos, rate)}</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${isPos ? styles.kpiCardSuccess : styles.kpiCardDanger}`}>
          {isPos
            ? <TrendingUp size={16} className={`${styles.kpiIcon} ${styles.kpiIconSuccess}`} aria-hidden="true" />
            : <TrendingDown size={16} className={`${styles.kpiIcon} ${styles.kpiIconDanger}`} aria-hidden="true" />
          }
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Utilidad</span>
            <span className={`${styles.kpiPrimary} ${isPos ? styles.kpiPrimarySuccess : styles.kpiPrimaryDanger}`}>
              {isPos ? '' : '−'}{fmtUsd(er.utilidad_neta)}
            </span>
            <span className={styles.kpiSub2}>{fmtBs(Math.abs(er.utilidad_neta), rate)}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <Percent size={16} className={`${styles.kpiIcon} ${styles.kpiIconMuted}`} aria-hidden="true" />
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Margen</span>
            <span className={`${styles.kpiPrimary} ${isPos ? styles.kpiPrimarySuccess : styles.kpiPrimaryDanger}`}>
              {fmtPct(er.margen_neto_pct)}
            </span>
            <span className={`${styles.kpiSub2} ${styles.kpiSub2Margen}`}>Margen bruto: {fmtPct(er.margen_bruto_pct)}</span>
          </div>
        </div>

      </div>

      {/* ── Estado de Resultados visual ── */}
      <div className={styles.erCard}>
        <h3 className={styles.erTitle}>Estado de Resultados</h3>
        {data.insight && <p className={styles.erInsight}>{data.insight}</p>}

        <div className={styles.plSection}>

          <div className={styles.plRow}>
            <span className={styles.plLabel}>Ventas brutas</span>
            <div className={styles.plBarWrap}>
              <div className={`${styles.plBarFill} ${styles.plBarBrand}`} style={{ width: '100%' }} />
            </div>
            <span className={styles.plValue}>{fmtUsd(er.ventas_netas)}</span>
            <span className={styles.plPct}>100%</span>
          </div>

          <div className={styles.plRow}>
            <span className={styles.plLabel}>− Costo de ventas</span>
            <div className={styles.plBarWrap}>
              <div className={`${styles.plBarFill} ${styles.plBarMuted}`} style={{ width: barW(er.costo_ventas) }} />
            </div>
            <span className={styles.plValue}>({fmtUsd(er.costo_ventas)})</span>
            <span className={styles.plPct}>{fmtPct(100 - er.margen_bruto_pct)}</span>
          </div>

          <hr className={styles.plDivider} />

          <div className={styles.plRow}>
            <span className={styles.plSubtotalLabel}>= Utilidad bruta</span>
            <div className={styles.plBarWrap}>
              <div className={`${styles.plBarFill} ${styles.plBarBrand}`} style={{ width: barW(er.utilidad_bruta) }} />
            </div>
            <span className={styles.plValue}>{fmtUsd(er.utilidad_bruta)}</span>
            <span className={styles.plPct}>{fmtPct(er.margen_bruto_pct)}</span>
          </div>

          <div className={styles.plRow}>
            <span className={styles.plLabel}>− Gastos operativos</span>
            <div className={styles.plBarWrap}>
              <div className={`${styles.plBarFill} ${styles.plBarWarning}`} style={{ width: barW(er.gastos_operativos) }} />
            </div>
            <span className={styles.plValue}>({fmtUsd(er.gastos_operativos)})</span>
            <span className={styles.plPct}>{safePct(er.gastos_operativos, er.ventas_netas)}</span>
          </div>

          <hr className={styles.plDivider} />

          <div className={styles.plRow}>
            <span className={styles.plSubtotalLabel}>= Utilidad neta</span>
            <div className={styles.plBarWrap}>
              <div
                className={`${styles.plBarFill} ${isPos ? styles.plBarSuccess : styles.plBarDanger}`}
                style={{ width: barW(er.utilidad_neta) }}
              />
            </div>
            <span className={styles.plValue}>{isPos ? '' : '−'}{fmtUsd(er.utilidad_neta)}</span>
            <span className={styles.plPct}>{fmtPct(Math.abs(er.margen_neto_pct))}</span>
          </div>

        </div>
      </div>

      {/* ── Punto de Equilibrio (datos server-side, no del navegador) ── */}
      <PuntoEquilibrioCard month={month} />

      {/* ── Gráfico comparativo ── */}
      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Comparativa del período</h3>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="38%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={96}>
                {chartData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={CHART_COLORS[entry.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className={styles.chartCaption}>
          {isPos
            ? `Utilidad neta: ${fmtUsd(er.utilidad_neta)} · Margen: ${fmtPct(er.margen_neto_pct)}`
            : `Pérdida neta: ${fmtUsd(Math.abs(er.utilidad_neta))} · Margen: ${fmtPct(er.margen_neto_pct)}`}
        </p>
      </div>

      {/* ── Gráfico diario: Utilidad del período ── */}
      <DailyTrendCard month={month} />
    </>
  )
}
