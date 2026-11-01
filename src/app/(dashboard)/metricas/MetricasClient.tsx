'use client'

import { useCallback, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { businessDateKey, businessMonthKey, shiftDateKey } from '@/lib/business-day'
import type { GroupMetricRow, MetricsCashier, MetricsGroupBy } from '@/types/metrics'
import { apiError } from './format'
import { GruposTab } from './GruposTab'
import { MetasTab } from './MetasTab'
import { ProductosTab } from './ProductosTab'
import { useApiData } from './useApiData'
import styles from './metricas.module.css'

type Preset = 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'custom'
type Tab = 'productos' | 'grupos' | 'metas'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: 'custom', label: 'Personalizado' },
]
const TABS: { value: Tab; label: string }[] = [
  { value: 'productos', label: 'Productos' },
  { value: 'grupos', label: 'Categorías y marcas' },
  { value: 'metas', label: 'Metas' },
]
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

interface DateRange { from: string; to: string }

/** Rango del atajo, en fechas del negocio (America/Caracas). La semana arranca el lunes. */
function presetRange(preset: Exclude<Preset, 'custom'>): DateRange {
  const today = businessDateKey()
  if (preset === 'hoy') return { from: today, to: today }
  if (preset === 'semana') {
    const [y, m, d] = today.split('-').map(Number)
    const sinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    return { from: shiftDateKey(today, -sinceMonday), to: today }
  }
  if (preset === 'mes') return { from: `${businessMonthKey()}-01`, to: today }
  const prevFrom = `${businessMonthKey(new Date(), 1)}-01`
  return { from: prevFrom, to: shiftDateKey(`${businessMonthKey()}-01`, -1) }
}

export function MetricasClient() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('productos')
  const [preset, setPreset] = useState<Preset>('mes')
  const [custom, setCustom] = useState<DateRange>(() => presetRange('mes'))
  const [cashierId, setCashierId] = useState('')
  const [q, setQ] = useState('')
  const [by, setBy] = useState<MetricsGroupBy>('category')
  const [pick, setPick] = useState<{ by: 'category' | 'brand'; id: number; label: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const cashiers = useApiData<MetricsCashier[]>('/api/metrics/cashiers')

  const range = preset === 'custom' ? custom : presetRange(preset)
  const base = new URLSearchParams({ from: range.from, to: range.to })
  if (cashierId) base.set('cashier_id', cashierId)
  const groupsQs = base.toString()

  const productsParams = new URLSearchParams(base)
  if (pick?.by === 'category') productsParams.set('category_id', String(pick.id))
  if (pick?.by === 'brand') productsParams.set('brand_id', String(pick.id))
  if (q) productsParams.set('q', q)
  const productsQs = productsParams.toString()

  const onPick = useCallback((groupBy: MetricsGroupBy, row: GroupMetricRow): void => {
    if (groupBy === 'subcategory' || row.key_id === null) return
    setPick({ by: groupBy, id: row.key_id, label: `${groupBy === 'category' ? 'Categoría' : 'Marca'}: ${row.label}` })
    setTab('productos')
  }, [])

  const exportar = async (): Promise<void> => {
    const view = tab === 'productos' ? 'products' : 'groups'
    const params = new URLSearchParams(tab === 'productos' ? productsParams : base)
    params.set('view', view)
    if (view === 'groups') params.set('by', by)
    setExporting(true)
    try {
      const res = await fetch(`/api/metrics/export?${params.toString()}`)
      if (!res.ok) throw new Error(await apiError(res))
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: XLSX_MIME }))
      const a = document.createElement('a')
      a.href = url
      a.download = `metricas-${view}-${range.from}_a_${range.to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo exportar.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const filtersOff = tab === 'metas'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Métricas</h1>
        <p className={styles.subtitle}>Lo que vendiste, producto por producto, y cuánto te falta para tus metas</p>
      </header>

      <fieldset className={styles.filters} disabled={filtersOff} aria-label="Filtros">
        <div className={styles.segment} role="group" aria-label="Rango de fechas">
          {PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              className={p.value === preset ? `${styles.segBtn} ${styles.segActive}` : styles.segBtn}
              aria-pressed={p.value === preset}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className={styles.dates}>
            <input type="date" className={styles.control} value={custom.from} max={custom.to} aria-label="Desde" onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} />
            <input type="date" className={styles.control} value={custom.to} min={custom.from} aria-label="Hasta" onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} />
          </div>
        )}
        <select className={styles.control} value={cashierId} onChange={e => setCashierId(e.target.value)} aria-label="Vendedor">
          <option value="">Todos los vendedores</option>
          {(cashiers.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download size={16} aria-hidden="true" />}
          loading={exporting}
          disabled={filtersOff}
          title={filtersOff ? 'Las metas no se exportan' : undefined}
          onClick={exportar}
        >
          Exportar Excel
        </Button>
      </fieldset>
      {cashiers.error && !filtersOff && <p className={styles.formError} role="alert">No se pudo cargar la lista de vendedores: {cashiers.error}</p>}

      <div className={styles.tabs} role="tablist" aria-label="Vistas de métricas">
        {TABS.map(t => (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={t.value === tab}
            aria-controls={`panel-${t.value}`}
            className={t.value === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'productos' && (
          <ProductosTab qs={productsQs} q={q} onQ={setQ} filterLabel={pick?.label ?? null} onClearFilter={() => setPick(null)} />
        )}
        {tab === 'grupos' && <GruposTab qs={groupsQs} by={by} onBy={setBy} onPick={onPick} />}
        {tab === 'metas' && <MetasTab />}
      </div>
    </div>
  )
}
