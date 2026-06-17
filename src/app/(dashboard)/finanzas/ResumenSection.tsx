'use client'

import { useState, useEffect } from 'react'
import styles from './finanzas.module.css'

interface Props { month: string }

interface EstadoResultados {
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
  estado_resultados: EstadoResultados
  insight:           string
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ResumenSection({ month }: Props) {
  const [data, setData]       = useState<ResumenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setData(null)
    setError(false)
    fetch(`/api/finanzas/resumen?month=${month}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((j: { ok: boolean } & ResumenData) => {
        if (j.ok) setData(j)
        else setError(true)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(true)
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [month])

  if (loading) return <div className={styles.loading}>Cargando resumen...</div>
  if (error)   return <div className={styles.loading}>Error al cargar el resumen financiero. Intente de nuevo.</div>
  if (!data)   return <div className={styles.loading}>No hay datos financieros para este período.</div>

  const er           = data.estado_resultados
  const utilPositiva = er.utilidad_neta >= 0

  return (
    <>
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ingresos totales</span>
          <span className={styles.summaryValue}>{fmtUsd(data.ingresos_totales.usd)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Gastos totales</span>
          <span className={styles.summaryValue}>{fmtUsd(data.gastos_totales.usd)}</span>
        </div>
        <div className={`${styles.summaryCard} ${!utilPositiva ? styles.summaryDanger : ''}`}>
          <span className={styles.summaryLabel}>Utilidad neta</span>
          <span className={styles.summaryValue}>{fmtUsd(er.utilidad_neta)}</span>
        </div>
      </div>

      <div className={styles.erCard}>
        <h3 className={styles.erTitle}>Estado de Resultados</h3>
        {data.insight && <p className={styles.erInsight}>{data.insight}</p>}
        <div className={styles.erBody}>
          <div className={styles.erLinea}>
            <span>Ventas netas</span>
            <span>{fmtUsd(er.ventas_netas)}</span>
          </div>
          <div className={styles.erLinea}>
            <span>Costo de ventas</span>
            <span>({fmtUsd(er.costo_ventas)})</span>
          </div>
          <div className={styles.erSubtotal}>
            <span>
              Utilidad bruta{' '}
              <span className={styles.erPct}>({er.margen_bruto_pct.toFixed(1)}%)</span>
            </span>
            <span>{fmtUsd(er.utilidad_bruta)}</span>
          </div>
          <div className={styles.erLinea}>
            <span>Gastos operativos</span>
            <span>({fmtUsd(er.gastos_operativos)})</span>
          </div>
          <div className={utilPositiva ? styles.erPositivo : styles.erNegativo}>
            <span>
              Utilidad neta{' '}
              <span className={styles.erPct}>({er.margen_neto_pct.toFixed(1)}%)</span>
            </span>
            <span>{fmtUsd(er.utilidad_neta)}</span>
          </div>
        </div>
      </div>
    </>
  )
}
