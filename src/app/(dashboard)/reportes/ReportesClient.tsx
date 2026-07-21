'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  ArrowUpDown, BarChart2, Calculator, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, Clock, CreditCard, Download,
  FileSpreadsheet, Package, Receipt, Search, X, CalendarRange,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { UpgradeModal } from '@/components/ui/UpgradeModal'
import { usePlanGate } from '@/hooks/usePlanGate'
import { MonthlyReportBanner } from '@/components/reports/MonthlyReportBanner'
import { VentasPage } from '../ventas/VentasPage'
import { HelpButton } from '@/components/help/HelpButton'
import styles from './reportes.module.css'

/* ── Types ── */

type Tab = 'dia' | 'ventas' | 'inventario' | 'cierres'

interface PaymentMethodData {
  id: number; name: string; type: string; totalUsd: number; totalBs: number; count: number
}
interface TopProduct {
  productId: number; name: string; quantity: number; totalUsd: number; totalBs: number
}
interface DailyData {
  date: string; rate: number; salesCount: number; totalUsd: number; totalBs: number
  byPaymentMethod: PaymentMethodData[]; topProducts: TopProduct[]
}
interface RangeData {
  from: string; to: string; rate: number; salesCount: number; totalUsd: number; totalBs: number
  byPaymentMethod: PaymentMethodData[]; topProducts: TopProduct[]
}
interface InvEntry {
  id: number; quantity: number; waste: number; cost_per_unit_usd: number | null
  supplier: string | null; notes: string | null; entered_at: string
  product: { id: number; name: string; base_unit_label: string }
  user: { id: number; name: string } | null
}
interface CashHistItem {
  id: number; openedAt: string; closedAt: string | null; cashierName: string
  openingAmountUsd: number; closingAmountUsd: number | null; rateAtOpen: number
  closeNotes: string | null; salesCount: number
  totalVentasUsd: number; efectivoEsperado: number; efectivoContado: number | null
  diferencia: number | null
}

/* ── Helpers ── */

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number) =>
  `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const todayStr = () => new Date().toISOString().slice(0, 10)

function prevMonthPeriod(): { period: string; label: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { period: d.toISOString().slice(0, 7), label: d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) }
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getInvType(e: InvEntry): 'entrada' | 'ajuste' { return e.waste > 0 ? 'ajuste' : 'entrada' }

/* Genera un .xlsx en el navegador y dispara la descarga — mismo dynamic import
   que ya usa handleExport (PDF) en ReporteDiaContent. Se usa donde no existe
   un endpoint de exportación dedicado (Ventas, Cierres). */
async function downloadXlsxFromRows(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin datos': '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const blob = new Blob([new Uint8Array(raw)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* Descarga un blob desde un endpoint real de exportación (mismo patrón que
   handleExportExcel en ReporteDiaContent, reusado para /api/inventory/export) */
async function downloadBlobFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('export failed')
  const blob = await res.blob()
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objUrl)
}

interface SalesExportRow {
  ticket_number: string
  status: string
  total_usd: number
  total_bs: number
  sold_at: string | null
  created_at: string
  client_name: string | null
  client: { name: string } | null
  payments: Array<{ payment_method: { name: string } }>
}

/* ── Shared sub-components ── */

interface KpiProps {
  icon: React.ReactNode; label: string; primary: string; sub?: string; trend?: 'up' | 'down' | null
}
function KpiCard({ icon, label, primary, sub, trend }: KpiProps) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiBody}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiPrimary}>{primary}</span>
        {sub && <span className={styles.kpiSub}>{sub}</span>}
      </div>
      {trend && (
        <div className={`${styles.kpiTrend} ${trend === 'up' ? styles.kpiTrendUp : styles.kpiTrendDown}`}>
          {trend === 'up' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      )}
    </div>
  )
}

interface PayBarProps { name: string; totalUsd: number; maxUsd: number; totalAll: number }
function PayBar({ name, totalUsd, maxUsd, totalAll }: PayBarProps) {
  const pct    = maxUsd > 0 ? (totalUsd / maxUsd) * 100 : 0
  const pctAbs = totalAll > 0 ? ((totalUsd / totalAll) * 100).toFixed(1) : '0.0'
  return (
    <div className={styles.payRow}>
      <div className={styles.payMeta}>
        <span className={styles.payName}>{name}</span>
        <span className={styles.payPct}>{pctAbs}%</span>
        <span className={styles.payAmt}>{fmtUsd(totalUsd)}</span>
      </div>
      <div className={styles.payTrack}>
        <div className={styles.payFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Tab: Reporte del Día (migrated from old page.tsx) ── */

function ReporteDiaContent() {
  const { toast } = useToast()
  const { guardedFetch, upgradeReason, clearUpgrade } = usePlanGate()
  const [date,           setDate]           = useState<string>(todayStr)
  const [data,           setData]           = useState<DailyData | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [exporting,      setExporting]      = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [businessName,   setBusinessName]   = useState('Mi Negocio')
  const [rangeMode,      setRangeMode]      = useState(false)
  const [rangeFrom,      setRangeFrom]      = useState('')
  const [rangeTo,        setRangeTo]        = useState('')
  const [rangeData,      setRangeData]      = useState<RangeData | null>(null)
  const [rangeLoading,   setRangeLoading]   = useState(false)
  const [rangeOpen,      setRangeOpen]      = useState(false)

  type ProductSortKey = 'name' | 'quantity' | 'unit' | 'total'
  type SortDir = 'asc' | 'desc'
  const [prodSortKey, setProdSortKey] = useState<ProductSortKey | null>(null)
  const [prodSortDir, setProdSortDir] = useState<SortDir>('asc')
  const [prodSearch,  setProdSearch]  = useState('')
  const initRef = useRef(false)

  const handleProdSort = (key: ProductSortKey) => {
    if (prodSortKey === key) setProdSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setProdSortKey(key); setProdSortDir('asc') }
  }

  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.json())
      .then((j: { name?: string }) => { if (j.name) setBusinessName(j.name) })
      .catch(() => {})
  }, [])

  const fetchDaily = useCallback(async (d: string) => {
    setLoading(true); setData(null)
    try {
      const res = await fetch(`/api/reports/daily?date=${d}`)
      if (res.ok) {
        const json = await res.json() as { ok?: boolean; date?: string; rate?: number; sales_count?: number; total_usd?: number; total_bs?: number; by_payment_method?: PaymentMethodData[]; top_products?: Array<{ product_id: number; name: string; quantity: number; total_usd: number; total_bs: number }> }
        if (json.ok) setData({
          date:            json.date ?? d,
          rate:            json.rate ?? 0,
          salesCount:      json.sales_count ?? 0,
          totalUsd:        json.total_usd ?? 0,
          totalBs:         json.total_bs ?? 0,
          byPaymentMethod: json.by_payment_method ?? [],
          topProducts: (json.top_products ?? []).map(p => ({ productId: p.product_id, name: p.name, quantity: p.quantity, totalUsd: p.total_usd, totalBs: p.total_bs })),
        })
        else toast('Error al cargar el reporte', 'error')
      } else { toast('Error al cargar el reporte', 'error') }
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    fetchDaily(todayStr())
  }, [fetchDaily])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value; setDate(d); fetchDaily(d)
  }

  const handleExport = useCallback(async () => {
    if (!data || data.salesCount === 0) { toast('No hay ventas en este día', 'error'); return }
    setExporting(true)
    try {
      const { generateDailyReportPdf } = await import('@/lib/pdf-reports')
      await generateDailyReportPdf({ date: data.date, businessName, rate: data.rate, salesCount: data.salesCount, totalUsd: data.totalUsd, totalBs: data.totalBs, byPaymentMethod: data.byPaymentMethod, topProducts: data.topProducts })
      toast('PDF generado', 'success')
    } catch { toast('Error al generar el PDF', 'error') }
    finally { setExporting(false) }
  }, [data, toast, businessName])

  const handleExportExcel = useCallback(async () => {
    if (rangeMode && !rangeData) { toast('Selecciona un rango de fechas válido', 'error'); return }
    setExportingExcel(true)
    try {
      const query    = rangeMode && rangeData ? `from=${rangeData.from}&to=${rangeData.to}` : `date=${date}`
      const filename = rangeMode && rangeData ? `reporte-${rangeData.from}_a_${rangeData.to}.xlsx` : `reporte-${date}.xlsx`
      const res = await guardedFetch(`/api/reports/export-excel?${query}`)
      if (!res.ok) { if (res.status !== 403) toast('Error al exportar', 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { toast('Error al exportar', 'error') }
    finally { setExportingExcel(false) }
  }, [date, rangeMode, rangeData, toast])

  const fetchRange = useCallback(async (from: string, to: string) => {
    if (!from || !to || from > to) { toast('Selecciona un rango de fechas válido', 'error'); return }
    setRangeLoading(true); setRangeData(null)
    try {
      const res = await fetch(`/api/reports/range?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json() as { ok?: boolean; rate?: number; sales_count?: number; total_usd?: number; total_bs?: number; by_payment_method?: PaymentMethodData[]; top_products?: Array<{ product_id: number; name: string; quantity: number; total_usd: number; total_bs: number }> }
        if (json.ok) {
          setRangeData({ from, to, rate: json.rate ?? 0, salesCount: json.sales_count ?? 0, totalUsd: json.total_usd ?? 0, totalBs: json.total_bs ?? 0, byPaymentMethod: json.by_payment_method ?? [], topProducts: (json.top_products ?? []).map(p => ({ productId: p.product_id, name: p.name, quantity: p.quantity, totalUsd: p.total_usd, totalBs: p.total_bs })) })
          setRangeMode(true); setRangeOpen(false)
        } else { toast('Error al cargar el rango', 'error') }
      } else { toast('Error al cargar el rango', 'error') }
    } catch { toast('Error de conexión', 'error') }
    finally { setRangeLoading(false) }
  }, [toast])

  const handleClearRange = () => { setRangeMode(false); setRangeData(null); setRangeOpen(false); setRangeFrom(''); setRangeTo('') }
  const fmtRangeLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
  const { period, label: periodLabel } = prevMonthPeriod()

  const activeData    = rangeMode ? rangeData    : data
  const activeLoading = rangeMode ? rangeLoading : loading
  const totalPayments = activeData?.byPaymentMethod.reduce((s, p) => s + p.totalUsd, 0) ?? 0
  const maxPayment    = activeData ? Math.max(...activeData.byPaymentMethod.map(p => p.totalUsd), 0) : 0
  const avgTicket     = activeData && activeData.salesCount > 0 ? activeData.totalUsd / activeData.salesCount : 0
  const activeRate    = activeData?.rate ?? 1
  const filteredProducts = (activeData?.topProducts ?? []).filter(p =>
    !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())
  )

  return (
    <div className={`${styles.page} page-container`}>
      <MonthlyReportBanner period={period} periodLabel={periodLabel} />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{rangeMode ? 'Reporte por Rango' : 'Reporte Diario'}</h1>
          {rangeMode && rangeData ? (
            <p className={styles.rangeIndicator}>
              <CalendarRange size={13} aria-hidden="true" />
              Mostrando: {fmtRangeLabel(rangeData.from)} — {fmtRangeLabel(rangeData.to)}
              <button type="button" className={styles.rangeClearBtn} onClick={handleClearRange} aria-label="Volver a reporte diario">
                <X size={12} aria-hidden="true" />
              </button>
            </p>
          ) : (
            <p className={styles.pageSubtitle}>Resumen de ventas, métodos de pago y productos del día.</p>
          )}
        </div>
        <div className={styles.headerActions}>
          {!rangeMode && (
            <input type="date" value={date} max={todayStr()} onChange={handleDateChange} className={styles.dateInput} aria-label="Seleccionar fecha" />
          )}
          <Button variant={rangeOpen ? 'primary' : 'ghost'} size="sm" leftIcon={<CalendarRange size={14} aria-hidden="true" />} onClick={() => { if (rangeMode) handleClearRange(); else setRangeOpen(o => !o) }} aria-pressed={rangeOpen || rangeMode}>
            {rangeMode ? 'Limpiar rango' : 'Rango personalizado'}
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />} onClick={handleExportExcel} loading={exportingExcel} disabled={!activeData || activeLoading} aria-label="Exportar Excel">
            Excel
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Download size={14} aria-hidden="true" />} onClick={handleExport} loading={exporting} disabled={!data || data.salesCount === 0 || loading || rangeMode}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {rangeOpen && (
        <div className={styles.rangePanel}>
          <label className={styles.rangeLabel}>
            Desde
            <input type="date" value={rangeFrom} max={todayStr()} onChange={e => setRangeFrom(e.target.value)} className={styles.rangeDateInput} aria-label="Fecha de inicio del rango" />
          </label>
          <label className={styles.rangeLabel}>
            Hasta
            <input type="date" value={rangeTo} max={todayStr()} onChange={e => setRangeTo(e.target.value)} className={styles.rangeDateInput} aria-label="Fecha de fin del rango" />
          </label>
          <Button variant="primary" size="sm" onClick={() => void fetchRange(rangeFrom, rangeTo)} loading={rangeLoading} disabled={!rangeFrom || !rangeTo}>Aplicar</Button>
          <Button variant="ghost" size="sm" onClick={() => setRangeOpen(false)}>Cancelar</Button>
        </div>
      )}

      {activeLoading ? (
        <div className={styles.loadingState}>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <p>Cargando reporte…</p>
        </div>
      ) : !activeData ? (
        <div className={styles.emptyState}>
          <BarChart2 size={36} className={styles.emptyIcon} aria-hidden="true" />
          <p>Selecciona una fecha para ver el reporte.</p>
        </div>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard icon={<BarChart2 size={18} aria-hidden="true" />} label={rangeMode ? 'Total del período' : 'Total del día'} primary={fmtUsd(activeData.totalUsd)} sub={fmtBs(activeData.totalBs)} />
            <KpiCard icon={<Package size={18} aria-hidden="true" />} label="Tickets cobrados" primary={String(activeData.salesCount)} sub={activeData.salesCount === 1 ? 'venta' : 'ventas'} />
            <KpiCard icon={<CreditCard size={18} aria-hidden="true" />} label="Ticket promedio" primary={fmtUsd(avgTicket)} sub={fmtBs(avgTicket * activeRate)} />
          </div>

          {activeData.byPaymentMethod.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Por método de pago</h2>
              <div className={styles.payList}>
                {[...activeData.byPaymentMethod].sort((a, b) => b.totalUsd - a.totalUsd).map(pm => (
                  <PayBar key={pm.id} name={pm.name} totalUsd={pm.totalUsd} maxUsd={maxPayment} totalAll={totalPayments} />
                ))}
              </div>
            </div>
          )}

          {activeData.topProducts.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>{rangeMode ? 'Top productos del período' : 'Top productos del día'}</h2>
              <div className={styles.sectionSearchRow}>
                <div className={styles.tabSearchWrap}>
                  <Search size={13} className={styles.tabSearchIcon} aria-hidden="true" />
                  <input
                    type="search"
                    className={styles.tabSearchInput}
                    value={prodSearch}
                    onChange={e => setProdSearch(e.target.value)}
                    placeholder="Buscar producto…"
                    aria-label="Buscar producto"
                  />
                </div>
              </div>
              {filteredProducts.length === 0 ? (
                <div className={styles.emptyState}>
                  <Package size={32} className={styles.emptyIcon} aria-hidden="true" />
                  <p>Sin productos que coincidan con la búsqueda.</p>
                </div>
              ) : (
              <div className={styles.tableScroll}>
                <table className={styles.reportTable}>
                  <thead>
                    <tr>
                      <th className={`${styles.th} ${styles.colProducto}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('name')}>
                          Producto {prodSortKey === 'name' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colCant} ${styles.thHidden}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('quantity')}>
                          Cant. {prodSortKey === 'quantity' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colPrecio} ${styles.thHidden}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('unit')}>
                          P. Unit. {prodSortKey === 'unit' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colTotal}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('total')}>
                          Total {prodSortKey === 'total' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredProducts].sort((a, b) => {
                      if (!prodSortKey) return 0
                      const ua = a.quantity > 0 ? a.totalUsd / a.quantity : 0
                      const ub = b.quantity > 0 ? b.totalUsd / b.quantity : 0
                      let cmp = 0
                      if (prodSortKey === 'name')     cmp = a.name.localeCompare(b.name)
                      if (prodSortKey === 'quantity') cmp = a.quantity - b.quantity
                      if (prodSortKey === 'unit')     cmp = ua - ub
                      if (prodSortKey === 'total')    cmp = a.totalUsd - b.totalUsd
                      return prodSortDir === 'asc' ? cmp : -cmp
                    }).map((p, i) => {
                      const unitUsd = p.quantity > 0 ? p.totalUsd / p.quantity : 0
                      return (
                        <tr key={p.productId} className={i % 2 === 1 ? styles.rowEven : ''}>
                          <td className={`${styles.td} ${styles.colProducto}`} data-label="Producto">{p.name}</td>
                          <td className={`${styles.td} ${styles.colCant} ${styles.tdHidden}`} data-label="Cant.">{p.quantity}</td>
                          <td className={`${styles.td} ${styles.colPrecio} ${styles.tdHidden}`} data-label="P. Unit.">{fmtUsd(unitUsd)}</td>
                          <td className={`${styles.td} ${styles.colTotal}`} data-label="Total">
                            <span className={styles.totalBold}>{fmtUsd(p.totalUsd)}</span>
                            <br />
                            <span className={styles.tdSub}>{fmtBs(p.totalBs)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {activeData.salesCount === 0 && (
            <div className={styles.emptyState}>
              <BarChart2 size={32} className={styles.emptyIcon} aria-hidden="true" />
              <p>Sin ventas registradas{rangeMode ? ' en el rango seleccionado' : ` el ${date}`}.</p>
            </div>
          )}
        </>
      )}

      <UpgradeModal reason={upgradeReason} onClose={clearUpgrade} />
    </div>
  )
}

/* ── Tab: Inventario movimientos ── */

const INV_PAGE_SIZE = 20

function InvMovTab() {
  const { toast } = useToast()
  const [entries,  setEntries]  = useState<InvEntry[]>([])
  const [loading,  setLoading]  = useState(false)
  const [loaded,   setLoaded]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [tipo,     setTipo]     = useState<'all' | 'entrada' | 'ajuste'>('all')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [page,     setPage]     = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (loaded) return
    setLoading(true)
    fetch('/api/inventory')
      .then(r => r.ok ? r.json() : null)
      .then((d: { entries?: InvEntry[] } | null) => {
        if (d?.entries) setEntries(d.entries)
        setLoaded(true)
      })
      .catch(() => toast('Error al cargar inventario', 'error'))
      .finally(() => setLoading(false))
  }, [loaded, toast])

  const filtered = useMemo(() => entries.filter(e => {
    if (search && !e.product.name.toLowerCase().includes(search.toLowerCase())) return false
    const t = getInvType(e)
    if (tipo !== 'all' && t !== tipo) return false
    const day = e.entered_at.slice(0, 10)
    if (from && day < from) return false
    if (to   && day > to)   return false
    return true
  }), [entries, search, tipo, from, to])

  const totalPages    = Math.max(1, Math.ceil(filtered.length / INV_PAGE_SIZE))
  const safePage      = Math.min(page, totalPages - 1)
  const paginated     = filtered.slice(safePage * INV_PAGE_SIZE, (safePage + 1) * INV_PAGE_SIZE)
  const hasFilters    = search || tipo !== 'all' || from || to

  function resetFilters() { setSearch(''); setTipo('all'); setFrom(''); setTo(''); setPage(0) }

  const handleExportInv = useCallback(async () => {
    setExporting(true)
    try {
      const q = new URLSearchParams()
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      if (tipo === 'entrada') q.set('type', 'entry')
      if (tipo === 'ajuste')  q.set('type', 'adjust')
      if (search.trim()) q.set('product', search.trim())
      await downloadBlobFromUrl(`/api/inventory/export?${q.toString()}`, `inventario-${todayStr()}.xlsx`)
      toast('Excel generado', 'success')
    } catch {
      toast('Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }, [from, to, tipo, search, toast])

  return (
    <div className={styles.tabInner}>
      <div className={styles.tabSectionHeader}>
        <h2 className={styles.tabSectionTitle}>Movimientos de inventario</h2>
        <span className={styles.tabCountBadge}>{filtered.length}</span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
          onClick={handleExportInv}
          loading={exporting}
          disabled={filtered.length === 0}
          aria-label="Exportar Excel"
        >
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.tabFilters}>
        <div className={styles.tabSearchWrap}>
          <Search size={13} className={styles.tabSearchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.tabSearchInput}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
          />
        </div>
        <select
          className={styles.tabSelect}
          value={tipo}
          onChange={e => { setTipo(e.target.value as 'all' | 'entrada' | 'ajuste'); setPage(0) }}
          aria-label="Tipo de movimiento"
        >
          <option value="all">Todos los tipos</option>
          <option value="entrada">Entrada</option>
          <option value="ajuste">Ajuste / Merma</option>
        </select>
        <input type="date" className={styles.tabDateInput} value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} aria-label="Desde" title="Desde" />
        <input type="date" className={styles.tabDateInput} value={to}   onChange={e => { setTo(e.target.value);   setPage(0) }} aria-label="Hasta" title="Hasta" />
        {hasFilters && (
          <button className={styles.tabClearBtn} onClick={resetFilters} type="button" aria-label="Limpiar filtros">
            <X size={12} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.tabLoading}>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <p>Cargando movimientos…</p>
        </div>
      ) : paginated.length === 0 ? (
        <div className={styles.emptyState}>
          <Package size={32} className={styles.emptyIcon} aria-hidden="true" />
          <p>{hasFilters ? 'Sin resultados para los filtros aplicados' : 'Sin movimientos de inventario'}</p>
        </div>
      ) : (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.reportTable} aria-label="Movimientos de inventario">
              <thead>
                <tr>
                  <th className={styles.th}>Fecha</th>
                  <th className={styles.th}>Producto</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Tipo</th>
                  <th className={`${styles.th} ${styles.colCant}`}>Cantidad</th>
                  <th className={`${styles.th} ${styles.colPrecio} ${styles.thHidden}`}>Costo / u</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((e, i) => {
                  const t    = getInvType(e)
                  const isW  = e.product.base_unit_label !== 'und'
                  const qty  = t === 'ajuste'
                    ? `-${e.waste.toFixed(isW ? 3 : 0)}`
                    : `+${e.quantity.toFixed(isW ? 3 : 0)}`
                  return (
                    <tr key={e.id} className={i % 2 === 1 ? styles.rowEven : ''}>
                      <td className={styles.td} data-label="Fecha">
                        <span className={styles.dateCell}>
                          <Clock size={10} aria-hidden="true" />
                          {fmtDateTime(e.entered_at)}
                        </span>
                      </td>
                      <td className={styles.td} data-label="Producto">
                        <strong>{e.product.name}</strong>
                        <span className={styles.tdSub}>&nbsp;{e.product.base_unit_label}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdHidden}`} data-label="Tipo">
                        <span className={t === 'entrada' ? styles.badgeEntrada : styles.badgeAjuste}>
                          {t === 'entrada' ? 'Entrada' : 'Ajuste'}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.colCant}`} data-label="Cantidad">
                        <span className={t === 'entrada' ? styles.qtyPos : styles.qtyNeg}>
                          {qty}&nbsp;{e.product.base_unit_label}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.colPrecio} ${styles.tdHidden}`} data-label="Costo / u">
                        {e.cost_per_unit_usd != null ? fmtUsd(e.cost_per_unit_usd) : <span className={styles.tdDash}>—</span>}
                      </td>
                      <td className={`${styles.td} ${styles.tdHidden}`} data-label="Proveedor">{e.supplier ?? <span className={styles.tdDash}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.tabPagination}>
              <button className={styles.tabPaginBtn} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} type="button" aria-label="Anterior">
                <ChevronLeft size={14} aria-hidden="true" /> Anterior
              </button>
              <span className={styles.tabPaginInfo}>Pág. {safePage + 1} de {totalPages} · {filtered.length} registros</span>
              <button className={styles.tabPaginBtn} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} type="button" aria-label="Siguiente">
                Siguiente <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Tab: Cierres de Caja ── */

function CierresTab() {
  const { toast } = useToast()
  const [history,  setHistory]  = useState<CashHistItem[]>([])
  const [loading,  setLoading]  = useState(false)
  const [noAccess, setNoAccess] = useState(false)
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [search,   setSearch]   = useState('')
  const [exporting, setExporting] = useState(false)
  const initRef = useRef(false)

  const fetchHistory = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (f) q.set('from', f)
      if (t) q.set('to', t)
      const res = await fetch(`/api/cash/history?${q.toString()}`)
      if (res.status === 403) { setNoAccess(true); return }
      if (!res.ok) { toast('Error al cargar cierres de caja', 'error'); return }
      const d = await res.json() as { ok: boolean; history: CashHistItem[] }
      if (d.ok) setHistory(d.history)
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    fetchHistory('', '')
  }, [fetchHistory])

  if (noAccess) {
    return (
      <div className={styles.tabInner}>
        <div className={styles.emptyState}>
          <Calculator size={32} className={styles.emptyIcon} aria-hidden="true" />
          <p>Solo administradores pueden ver los cierres de caja.</p>
        </div>
      </div>
    )
  }

  const filtered = search
    ? history.filter(h => h.cashierName.toLowerCase().includes(search.toLowerCase()))
    : history

  const handleExportCierres = useCallback(async () => {
    setExporting(true)
    try {
      const rows = filtered.map(h => {
        const rate        = h.rateAtOpen > 0 ? h.rateAtOpen : 1
        const esperadoUsd  = h.efectivoEsperado / rate
        const contadoUsd   = h.efectivoContado != null ? h.efectivoContado / rate : null
        const difUsd       = h.diferencia != null ? h.diferencia / rate : null
        return {
          'Cajero':         h.cashierName,
          'Apertura':       fmtDateTime(h.openedAt),
          'Cierre':         h.closedAt ? fmtDateTime(h.closedAt) : 'Abierta',
          'Ventas':         h.salesCount,
          'Ventas USD':     Math.round(h.totalVentasUsd * 100) / 100,
          'Esperado USD':   Math.round(esperadoUsd * 100) / 100,
          'Contado USD':    contadoUsd != null ? Math.round(contadoUsd * 100) / 100 : '',
          'Diferencia USD': difUsd != null ? Math.round(difUsd * 100) / 100 : '',
        }
      })
      await downloadXlsxFromRows(`cierres-caja-${todayStr()}.xlsx`, 'Cierres', rows)
      toast('Excel generado', 'success')
    } catch {
      toast('Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }, [filtered, toast])

  return (
    <div className={styles.tabInner}>
      <div className={styles.tabSectionHeader}>
        <h2 className={styles.tabSectionTitle}>Cierres de Caja</h2>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
          onClick={handleExportCierres}
          loading={exporting}
          disabled={filtered.length === 0}
          aria-label="Exportar Excel"
        >
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.tabFilters}>
        <div className={styles.tabSearchWrap}>
          <Search size={13} className={styles.tabSearchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.tabSearchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cajero…"
            aria-label="Buscar cajero"
          />
        </div>
        <input
          type="date"
          className={styles.tabDateInput}
          value={from}
          onChange={e => setFrom(e.target.value)}
          aria-label="Desde"
          title="Desde"
        />
        <input
          type="date"
          className={styles.tabDateInput}
          value={to}
          onChange={e => setTo(e.target.value)}
          aria-label="Hasta"
          title="Hasta"
        />
        <Button variant="primary" size="sm" onClick={() => fetchHistory(from, to)} loading={loading}>
          Filtrar
        </Button>
        {(search || from || to) && (
          <button className={styles.tabClearBtn} onClick={() => { setSearch(''); setFrom(''); setTo(''); fetchHistory('', '') }} type="button" aria-label="Limpiar filtros">
            <X size={12} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.tabLoading}>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <p>Cargando cierres…</p>
        </div>
      ) : history.length === 0 ? (
        <div className={styles.emptyState}>
          <Calculator size={32} className={styles.emptyIcon} aria-hidden="true" />
          <p>Sin cierres de caja registrados.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Calculator size={32} className={styles.emptyIcon} aria-hidden="true" />
          <p>Sin resultados para la búsqueda.</p>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.reportTable} aria-label="Cierres de caja">
            <thead>
              <tr>
                <th className={styles.th}>Cajero</th>
                <th className={`${styles.th} ${styles.thHidden}`}>Apertura</th>
                <th className={`${styles.th} ${styles.thHidden}`}>Cierre</th>
                <th className={`${styles.th} ${styles.colPrecio}`}>Ventas USD</th>
                <th className={`${styles.th} ${styles.colPrecio} ${styles.thHidden}`}>Esperado USD</th>
                <th className={`${styles.th} ${styles.colPrecio} ${styles.thHidden}`}>Contado USD</th>
                <th className={`${styles.th} ${styles.colPrecio}`}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => {
                const rate           = h.rateAtOpen > 0 ? h.rateAtOpen : 1
                const esperadoUsd    = h.efectivoEsperado / rate
                const contadoUsd     = h.efectivoContado != null ? h.efectivoContado / rate : null
                const difUsd         = h.diferencia != null ? h.diferencia / rate : null
                const difPos         = difUsd !== null && difUsd >= 0
                return (
                  <tr key={h.id} className={i % 2 === 1 ? styles.rowEven : ''}>
                    <td className={styles.td} data-label="Cajero">
                      <strong>{h.cashierName}</strong>
                      <span className={styles.tdSub}>&nbsp;· {h.salesCount} ventas</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Apertura">
                      <span className={styles.dateCell}>
                        <Clock size={10} aria-hidden="true" />
                        {fmtDateTime(h.openedAt)}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Cierre">
                      {h.closedAt ? (
                        <span className={styles.dateCell}>
                          <Clock size={10} aria-hidden="true" />
                          {fmtDateTime(h.closedAt)}
                        </span>
                      ) : (
                        <span className={styles.badgeEntrada}>Abierta</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.colPrecio}`} data-label="Ventas USD">
                      <span className={styles.totalBold}>{fmtUsd(h.totalVentasUsd)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.colPrecio} ${styles.tdHidden}`} data-label="Esperado USD">
                      {fmtUsd(esperadoUsd)}
                    </td>
                    <td className={`${styles.td} ${styles.colPrecio} ${styles.tdHidden}`} data-label="Contado USD">
                      {contadoUsd !== null ? fmtUsd(contadoUsd) : <span className={styles.tdDash}>—</span>}
                    </td>
                    <td className={`${styles.td} ${styles.colPrecio}`} data-label="Diferencia">
                      {difUsd !== null ? (
                        <span className={difPos ? styles.difPos : styles.difNeg}>
                          {difPos ? '+' : ''}{fmtUsd(difUsd)}
                        </span>
                      ) : (
                        <span className={styles.tdDash}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Tab configuration ── */

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'dia',       label: 'Reporte del Día',  icon: <BarChart2 size={14} aria-hidden="true" /> },
  { key: 'ventas',    label: 'Ventas',            icon: <Receipt   size={14} aria-hidden="true" /> },
  { key: 'inventario',label: 'Inventario',        icon: <Package   size={14} aria-hidden="true" /> },
  { key: 'cierres',   label: 'Cierres de Caja',  icon: <Calculator size={14} aria-hidden="true" /> },
]

/* ── Main tabbed UI ── */

function ReportesInner({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('dia')
  const [exportingVentas, setExportingVentas] = useState(false)

  /* Ventas es <VentasPage> embebido — sus filtros internos no son accesibles
     desde aquí sin tocar VentasPage.tsx (fuera de scope). Export independiente:
     ventas pagadas del mes actual, no pretende reflejar el filtro visible. */
  const handleExportVentas = useCallback(async () => {
    setExportingVentas(true)
    try {
      const d = new Date()
      const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
      const to   = todayStr()
      const q = new URLSearchParams({
        from, to, use_created_at: '1', status: 'paid', limit: '2000', page: '1',
      })
      const res = await fetch(`/api/sales?${q.toString()}`)
      const json = await res.json() as { ok?: boolean; sales?: SalesExportRow[] }
      if (!res.ok || !json.sales) { toast('Error al exportar ventas', 'error'); return }
      const rows = json.sales.map(s => ({
        'Ticket':    s.ticket_number,
        'Fecha':     (s.sold_at ?? s.created_at).slice(0, 16).replace('T', ' '),
        'Cliente':   s.client?.name ?? s.client_name ?? '',
        'Total USD': s.total_usd,
        'Total Bs':  s.total_bs,
        'Método':    s.payments[0]?.payment_method?.name ?? '',
        'Estado':    s.status,
      }))
      await downloadXlsxFromRows(`ventas-${from}_${to}.xlsx`, 'Ventas', rows)
      toast('Excel generado — ventas pagadas del mes actual', 'success')
    } catch {
      toast('Error al exportar', 'error')
    } finally {
      setExportingVentas(false)
    }
  }, [toast])

  return (
    <div className={styles.tabRoot}>
      {/* Tab bar */}
      <nav className={styles.tabBar} role="tablist" aria-label="Secciones de reportes">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'dia' && (
        <div className={styles.tabPane}>
          <ReporteDiaContent />
        </div>
      )}
      {activeTab === 'ventas' && (
        <div className={styles.tabPaneFluid}>
          <div className={styles.tabSectionHeader}>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
              onClick={handleExportVentas}
              loading={exportingVentas}
              aria-label="Exportar ventas del mes actual a Excel"
            >
              Exportar Excel (mes actual)
            </Button>
          </div>
          <VentasPage isAdmin={isAdmin} />
        </div>
      )}
      {activeTab === 'inventario' && (
        <div className={styles.tabPane}>
          <InvMovTab />
        </div>
      )}
      {activeTab === 'cierres' && (
        <div className={styles.tabPane}>
          <CierresTab />
        </div>
      )}
      <HelpButton module="reportes" />
    </div>
  )
}

/* ── Public export ── */

export function ReportesClient({ isAdmin }: { isAdmin: boolean }) {
  return (
    <ToastProvider>
      <ReportesInner isAdmin={isAdmin} />
    </ToastProvider>
  )
}
