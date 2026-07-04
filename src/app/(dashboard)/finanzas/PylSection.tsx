'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import styles from './finanzas.module.css'

type Period = 'hoy' | '7dias' | 'mes' | 'anio'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'hoy',   label: 'Hoy'       },
  { key: '7dias', label: '7 días'    },
  { key: 'mes',   label: 'Este mes'  },
  { key: 'anio',  label: 'Este año'  },
]

/* ── CLI-A: implementar GET /api/finanzas/pyl?period=hoy|7dias|mes|anio ── */
/* Respuesta esperada: { ok: true, ingresos, cogs, opex, utilidad_bruta, utilidad_neta, margen_bruto } */
/* Todos los montos en USD; margen_bruto como porcentaje (ej. 42.5) */
interface PylData {
  ingresos:       number
  cogs:           number
  opex:           number
  utilidad_bruta: number
  utilidad_neta:  number
  margen_bruto:   number
}

interface Props { rate: number }

const fmtUsd = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number, rate: number) =>
  `Bs. ${(Math.abs(n) * rate).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

type LoadState = 'loading' | 'error' | 'ready'

export function PylSection({ rate }: Props) {
  const [period, setPeriod]       = useState<Period>('mes')
  const [data, setData]           = useState<PylData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    const ctrl = new AbortController()
    setLoadState('loading')
    fetch(`/api/finanzas/pyl?period=${period}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((j: { ok: boolean } & PylData) => {
        if (j.ok) { setData(j); setLoadState('ready') } else { setLoadState('error') }
      })
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setLoadState('error') })
    return () => ctrl.abort()
  }, [period])

  const periodRow = (
    <div className={styles.pylPeriodRow} role="tablist" aria-label="Período del estado de resultados">
      {PERIODS.map(p => (
        <button
          key={p.key}
          type="button"
          role="tab"
          aria-selected={period === p.key}
          className={`${styles.pylPeriodBtn} ${period === p.key ? styles.pylPeriodBtnActive : ''}`}
          onClick={() => setPeriod(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )

  if (loadState === 'loading') {
    return (
      <div>
        {periodRow}
        <div className={styles.pylGrid} aria-busy="true" aria-label="Cargando estado de resultados">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.pylSkeletonCard} />
          ))}
        </div>
      </div>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <div>
        {periodRow}
        <div className={styles.loading}>No se pudo cargar el estado de resultados. Intenta de nuevo.</div>
      </div>
    )
  }

  const isPos = data.utilidad_neta >= 0

  return (
    <div>
      {periodRow}

      <div className={styles.pylGrid}>
        <div className={`${styles.pylCard} ${styles.pylCardSuccess}`}>
          <span className={styles.pylCardLabel}>Ingresos</span>
          <span className={styles.pylCardValue}>{fmtUsd(data.ingresos)}</span>
          <span className={styles.pylCardSub}>{fmtBs(data.ingresos, rate)}</span>
        </div>

        <div className={`${styles.pylCard} ${styles.pylCardWarning}`}>
          <span className={styles.pylCardLabel}>Costo de ventas (COGS)</span>
          <span className={styles.pylCardValue}>{fmtUsd(data.cogs)}</span>
          <span className={styles.pylCardSub}>{fmtBs(data.cogs, rate)}</span>
        </div>

        <div className={`${styles.pylCard} ${styles.pylCardDanger}`}>
          <span className={styles.pylCardLabel}>Gastos operativos (OPEX)</span>
          <span className={styles.pylCardValue}>{fmtUsd(data.opex)}</span>
          <span className={styles.pylCardSub}>{fmtBs(data.opex, rate)}</span>
        </div>

        <div className={`${styles.pylCard} ${styles.pylCardInfo}`}>
          <span className={styles.pylCardLabel}>Utilidad bruta</span>
          <span className={styles.pylCardValue}>{fmtUsd(data.utilidad_bruta)}</span>
          <span className={styles.pylCardSub}>{fmtBs(data.utilidad_bruta, rate)}</span>
          <span className={styles.pylFormula}>Ingresos − COGS</span>
        </div>

        <div className={`${styles.pylCard} ${isPos ? styles.pylCardSuccessDark : styles.pylCardDanger}`}>
          <span className={styles.pylCardLabel}>
            {!isPos && <AlertTriangle size={14} className={styles.pylAlertIcon} aria-hidden="true" />}
            Utilidad neta
          </span>
          <span className={styles.pylCardValue}>{isPos ? '' : '−'}{fmtUsd(data.utilidad_neta)}</span>
          <span className={styles.pylCardSub}>{fmtBs(data.utilidad_neta, rate)}</span>
          <span className={styles.pylFormula}>Utilidad bruta − OPEX</span>
        </div>

        <div className={`${styles.pylCard} ${styles.pylCardMuted}`}>
          <span className={styles.pylCardLabel}>Margen bruto</span>
          <span className={`${styles.pylMarginBadge} ${data.margen_bruto >= 0 ? styles.pylMarginBadgePos : styles.pylMarginBadgeNeg}`}>
            {data.margen_bruto >= 0
              ? <TrendingUp size={14} aria-hidden="true" />
              : <TrendingDown size={14} aria-hidden="true" />}
            {data.margen_bruto.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
