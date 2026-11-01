'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Minus, Search, X } from 'lucide-react'
import type { ProductMetricRow, ProductsMetricsResponse } from '@/types/metrics'
import { deltaQty, fmtBs, fmtQty, fmtUsd, type Delta } from './format'
import { useApiData } from './useApiData'
import { ViewState } from './ViewState'
import styles from './metricas.module.css'

type SortKey = 'name' | 'category' | 'brand' | 'qty' | 'usd' | 'bs' | 'delta'
const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Producto', numeric: false },
  { key: 'category', label: 'Categoría', numeric: false },
  { key: 'brand', label: 'Marca', numeric: false },
  { key: 'qty', label: 'Unidades', numeric: true },
  { key: 'usd', label: 'USD', numeric: true },
  { key: 'bs', label: 'Bs', numeric: true },
  { key: 'delta', label: 'Vs. anterior', numeric: true },
]
const Q_DEBOUNCE_MS = 300

function sortValue(r: ProductMetricRow, key: SortKey): string | number {
  switch (key) {
    case 'name': return r.name.toLowerCase()
    case 'category': return (r.category ?? '').toLowerCase()
    case 'brand': return (r.brand ?? '').toLowerCase()
    case 'delta': return r.qty - r.prev_qty
    default: return r[key]
  }
}

export function DeltaBadge({ delta }: { delta: Delta }) {
  const cls = `${styles.delta} ${styles[`delta_${delta.dir}`]}`
  const Icon = delta.dir === 'up' ? ArrowUp : delta.dir === 'down' ? ArrowDown : Minus
  return (
    <span className={cls}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {delta.text}
    </span>
  )
}

interface ProductosTabProps {
  /** Query string completa (rango, vendedor, categoría/marca, q) — la misma que usa la exportación. */
  qs: string
  q: string
  onQ: (q: string) => void
  filterLabel: string | null
  onClearFilter: () => void
}

export function ProductosTab({ qs, q, onQ, filterLabel, onClearFilter }: ProductosTabProps) {
  const [reload, setReload] = useState(0)
  const [input, setInput] = useState(q)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'usd', dir: 'desc' })
  const { data, loading, error } = useApiData<ProductsMetricsResponse>(`/api/metrics/products?${qs}`, reload)

  useEffect(() => {
    if (input === q) return
    const t = setTimeout(() => onQ(input), Q_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [input, q, onQ])

  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])]
    const sign = sort.dir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      const va = sortValue(a, sort.key)
      const vb = sortValue(b, sort.key)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sign
    })
  }, [data, sort])

  const toggleSort = (key: SortKey): void =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'category' || key === 'brand' ? 'asc' : 'desc' }))

  const hasFilters = q !== '' || filterLabel !== null

  return (
    <section className={styles.card} aria-label="Ventas por producto">
      <div className={styles.cardTools}>
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            value={input}
            maxLength={60}
            placeholder="Buscar producto, código, categoría o marca"
            aria-label="Buscar producto"
            onChange={e => setInput(e.target.value)}
          />
        </label>
        {filterLabel && (
          <button type="button" className={styles.chip} onClick={onClearFilter} aria-label={`Quitar filtro ${filterLabel}`}>
            {filterLabel}
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyTitle={hasFilters ? 'No hay ventas con ese filtro' : 'No vendiste nada en estas fechas'}
        emptyHint={hasFilters ? 'Quita el filtro o la búsqueda para ver todo lo que vendiste.' : 'Prueba con otro rango, como "Este mes" o "Mes anterior".'}
        onRetry={() => setReload(n => n + 1)}
      >
        {data && (
          <p className={styles.summary} data-testid="metricas-resumen">
            Vendiste <strong>{fmtQty(data.totals.qty)}</strong> unidades · <strong>{fmtUsd(data.totals.usd)}</strong>
            <span className={styles.summaryBs}> {fmtBs(data.totals.bs)}</span>
          </p>
        )}
        <div className={styles.scroller}>
          <table className={styles.table} data-testid="metricas-tabla-productos">
            <thead>
              <tr>
                {COLUMNS.map(c => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.numeric ? styles.num : undefined}
                    aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className={styles.sortBtn} onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort.key === c.key
                        ? (sort.dir === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />)
                        : <ChevronsUpDown size={14} aria-hidden="true" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.product_id}>
                  <th scope="row" className={styles.rowName}>{r.name}</th>
                  <td>{r.category ?? <span className={styles.muted}>Sin categoría</span>}</td>
                  <td>{r.brand ?? <span className={styles.muted}>Sin marca</span>}</td>
                  <td className={styles.num}>{fmtQty(r.qty)}</td>
                  <td className={styles.num}>{fmtUsd(r.usd)}</td>
                  <td className={styles.num}>{fmtBs(r.bs)}</td>
                  <td className={styles.num}><DeltaBadge delta={deltaQty(r.qty, r.prev_qty)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ViewState>
    </section>
  )
}
