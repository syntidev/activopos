'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle } from 'lucide-react'
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

function computePE(er: ER, month: string) {
  const sin_margen = er.margen_bruto_pct <= 0
  const pe = !sin_margen
    ? er.gastos_operativos / (er.margen_bruto_pct / 100)
    : 0

  const [y, m] = month.split('-').map(Number)
  const today      = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(y, m, 0).getDate()
  const pctElapsed  = dayOfMonth / daysInMonth
  const projected   = pctElapsed > 0 ? er.ventas_netas / pctElapsed : 0

  const barPct = pe > 0 ? Math.min((er.ventas_netas / pe) * 100, 100) : 100

  type PEStatus = 'success' | 'progress' | 'risk'
  let status: PEStatus
  if (er.ventas_netas >= pe) {
    status = 'success'
  } else if (projected >= pe) {
    status = 'progress'
  } else {
    status = 'risk'
  }

  return { pe, projected, dayOfMonth, daysInMonth, barPct, status, sin_margen }
}

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
  const peData = computePE(er, month)

  /* P&L bars — proportional to ventas_netas */
  const barW = (n: number) =>
    er.ventas_netas > 0 ? `${Math.min((Math.abs(n) / er.ventas_netas) * 100, 100)}%` : '0%'

  const peBarClass =
    peData.status === 'success'  ? styles.peBarSuccess  :
    peData.status === 'progress' ? styles.peBarProgress :
    styles.peBarRisk

  const peStatusClass =
    peData.status === 'success'  ? styles.peStatusSuccess  :
    peData.status === 'progress' ? styles.peStatusProgress :
    styles.peStatusRisk

  return (
    <>
      {/* ── KPIs ── */}
      <div className={styles.kpiGrid}>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}><TrendingUp size={18} aria-hidden="true" /></div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Ventas del mes</span>
            <span className={styles.kpiPrimary}>{fmtUsd(er.ventas_netas)}</span>
            <span className={styles.kpiSub2}>{data.ingresos_totales.bs > 0
              ? `Bs. ${data.ingresos_totales.bs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
              : fmtBs(er.ventas_netas, rate)}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}><DollarSign size={18} aria-hidden="true" /></div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Gastos del mes</span>
            <span className={styles.kpiPrimary}>{fmtUsd(er.gastos_operativos)}</span>
            <span className={styles.kpiSub2}>{fmtBs(er.gastos_operativos, rate)}</span>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${isPos ? styles.kpiCardSuccess : styles.kpiCardDanger}`}>
          <div className={`${styles.kpiIconWrap} ${isPos ? styles.kpiIconWrapSuccess : styles.kpiIconWrapDanger}`}>
            {isPos ? <TrendingUp size={18} aria-hidden="true" /> : <TrendingDown size={18} aria-hidden="true" />}
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Utilidad neta</span>
            <span className={`${styles.kpiPrimary} ${isPos ? styles.kpiPrimarySuccess : styles.kpiPrimaryDanger}`}>
              {isPos ? '' : '−'}{fmtUsd(er.utilidad_neta)}
            </span>
            <span className={styles.kpiSub2}>{fmtBs(Math.abs(er.utilidad_neta), rate)}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}><Percent size={18} aria-hidden="true" /></div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel2}>Margen neto</span>
            <span className={`${styles.kpiPrimary} ${isPos ? styles.kpiPrimarySuccess : styles.kpiPrimaryDanger}`}>
              {fmtPct(er.margen_neto_pct)}
            </span>
            <span className={styles.kpiSub2}>Margen bruto: {fmtPct(er.margen_bruto_pct)}</span>
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

      {/* ── Punto de Equilibrio ── */}
      {peData.sin_margen ? (
        <div className={styles.peCard}>
          <div className={`${styles.peStatusRow} ${styles.peStatusRisk}`}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>El costo de ventas supera los ingresos — revisa tus precios</span>
          </div>
        </div>
      ) : peData.pe > 0 && (
        <div className={styles.peCard}>
          <h3 className={styles.peTitle}>
            Punto de Equilibrio — {new Date(month + '-01').toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
          </h3>

          <div className={styles.peStatsRow}>
            <div className={styles.peStat}>
              <span className={styles.peStatLabel}>Gastos fijos</span>
              <span className={styles.peStatValue}>{fmtUsd(er.gastos_operativos)}</span>
            </div>
            <div className={styles.peStat}>
              <span className={styles.peStatLabel}>Margen contribución</span>
              <span className={styles.peStatValue}>{fmtPct(er.margen_bruto_pct)}</span>
            </div>
            <div className={styles.peStat}>
              <span className={styles.peStatLabel}>Punto de equilibrio</span>
              <span className={styles.peStatValue}>{fmtUsd(peData.pe)}</span>
            </div>
          </div>

          <div className={styles.peBar}>
            <div className={`${styles.peBarFill} ${peBarClass}`} style={{ width: `${peData.barPct}%` }} />
          </div>

          <p className={styles.peCaption}>
            Ventas actuales: {fmtUsd(er.ventas_netas)} / PE: {fmtUsd(peData.pe)}
            {' '}· Día {peData.dayOfMonth} de {peData.daysInMonth}
            {' '}· Proyección: {fmtUsd(peData.projected)}
          </p>

          <div className={`${styles.peStatusRow} ${peStatusClass}`}>
            {peData.status === 'success' && (
              <>✅ Superado — Excedente: {fmtUsd(er.ventas_netas - peData.pe)}</>
            )}
            {peData.status === 'progress' && (
              <>⏳ En progreso — Faltan {fmtUsd(peData.pe - er.ventas_netas)} para cubrir gastos</>
            )}
            {peData.status === 'risk' && (
              <>⚠️ En riesgo — Proyección ({fmtUsd(peData.projected)}) no alcanza el PE</>
            )}
          </div>
        </div>
      )}
    </>
  )
}
