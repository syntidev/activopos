'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import type { GroupMetricRow, GroupsMetricsResponse, MetricsGroupBy } from '@/types/metrics'
import { deltaQty, fmtBs, fmtQty, fmtUsd } from './format'
import { DeltaBadge } from './ProductosTab'
import { useApiData } from './useApiData'
import { ViewState } from './ViewState'
import styles from './metricas.module.css'

export const GROUP_OPTIONS: { value: MetricsGroupBy; label: string }[] = [
  { value: 'category', label: 'Categoría' },
  { value: 'subcategory', label: 'Subcategoría' },
  { value: 'brand', label: 'Marca' },
]

/** Ancho dinámico de barra: única excepción tolerada de `style` (una custom property por fila). */
type BarStyle = CSSProperties & { '--w': string }
export const barStyle = (pct: number): BarStyle => ({ '--w': `${Math.max(0, Math.min(100, pct))}%` })

interface GruposTabProps {
  /** Query string de rango y vendedor, sin `by`. */
  qs: string
  by: MetricsGroupBy
  onBy: (by: MetricsGroupBy) => void
  /** Click en una fila de categoría o marca (la subcategoría no tiene filtro en Productos). */
  onPick: (by: MetricsGroupBy, row: GroupMetricRow) => void
}

export function GruposTab({ qs, by, onBy, onPick }: GruposTabProps) {
  const [reload, setReload] = useState(0)
  const { data, loading, error } = useApiData<GroupsMetricsResponse>(`/api/metrics/groups?by=${by}&${qs}`, reload)
  const rows = data?.rows ?? []
  const maxUsd = Math.max(0, ...rows.map(r => r.usd))
  const canPick = (r: GroupMetricRow): boolean => by !== 'subcategory' && r.key_id !== null

  return (
    <section className={styles.card} aria-label="Ventas por categoría y marca">
      <div className={styles.cardTools}>
        <div className={styles.segment} role="group" aria-label="Agrupar por">
          {GROUP_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              className={o.value === by ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
              aria-pressed={o.value === by}
              onClick={() => onBy(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle="No vendiste nada en estas fechas"
        emptyHint='Prueba con otro rango, como "Este mes" o "Mes anterior".'
        onRetry={() => setReload(n => n + 1)}
      >
        <ol className={styles.ranking} data-testid="metricas-ranking">
          {rows.map(r => {
            const inner = (
              <>
                <span className={styles.rankHead}>
                  <span className={styles.rankLabel}>{r.label}</span>
                  <span className={styles.rankUnits}>{fmtQty(r.qty)} unid.</span>
                  <DeltaBadge delta={deltaQty(r.qty, r.prev_qty)} />
                  {canPick(r) && <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
                </span>
                <span className={styles.barTrack}><span className={styles.barFill} style={barStyle(maxUsd > 0 ? (r.usd / maxUsd) * 100 : 0)} /></span>
                <span className={styles.rankMoney}>
                  <span className={styles.moneyUsd}>{fmtUsd(r.usd)}</span>
                  <span className={styles.moneyBs}>{fmtBs(r.bs)}</span>
                  <span className={styles.rankCount}>{r.products_count} {r.products_count === 1 ? 'producto' : 'productos'}</span>
                </span>
              </>
            )
            return (
              <li key={`${r.key_id ?? 'sin'}-${r.label}`} className={styles.rankItem}>
                {canPick(r)
                  ? <button type="button" className={styles.rankBtn} onClick={() => onPick(by, r)} aria-label={`Ver productos de ${r.label}`}>{inner}</button>
                  : <div className={styles.rankStatic}>{inner}</div>}
              </li>
            )
          })}
        </ol>
      </ViewState>
    </section>
  )
}
