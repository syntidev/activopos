'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, FileSpreadsheet, BarChart2, CreditCard, Package, ChevronUp, ChevronDown, CalendarRange, X, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { MonthlyReportBanner } from '@/components/reports/MonthlyReportBanner'
import styles from './reportes.module.css'

/* ── Types ───────────────────────────────────────────── */

interface PaymentMethodData {
  id:       number
  name:     string
  type:     string
  totalUsd: number
  totalBs:  number
  count:    number
}

interface TopProduct {
  productId: number
  name:      string
  quantity:  number
  totalUsd:  number
  totalBs:   number
}

interface DailyData {
  date:            string
  rate:            number
  salesCount:      number
  totalUsd:        number
  totalBs:         number
  byPaymentMethod: PaymentMethodData[]
  topProducts:     TopProduct[]
}

/* ── Helpers ─────────────────────────────────────────── */

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number) =>
  `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const todayStr = () => new Date().toISOString().slice(0, 10)

function prevMonthPeriod(): { period: string; label: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  const period = d.toISOString().slice(0, 7)
  const label  = d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
  return { period, label }
}

/* ── KPI Card ────────────────────────────────────────── */

interface KpiProps {
  icon:    React.ReactNode
  label:   string
  primary: string
  sub?:    string
  trend?:  'up' | 'down' | null
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

/* ── Payment method bar ──────────────────────────────── */

interface PayBarProps {
  name:     string
  totalUsd: number
  maxUsd:   number
  totalAll: number
}

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

/* ── Main content ────────────────────────────────────── */

interface RangeData {
  from:            string
  to:              string
  rate:            number
  salesCount:      number
  totalUsd:        number
  totalBs:         number
  byPaymentMethod: PaymentMethodData[]
  topProducts:     TopProduct[]
}

function ReportesContent() {
  const { toast } = useToast()

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
  const initRef = useRef(false)

  const handleProdSort = (key: ProductSortKey) => {
    if (prodSortKey === key) {
      setProdSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setProdSortKey(key)
      setProdSortDir('asc')
    }
  }

  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.json())
      .then((j: { name?: string }) => { if (j.name) setBusinessName(j.name) })
      .catch(() => {})
  }, [])

  const fetchDaily = useCallback(async (d: string) => {
    setLoading(true)
    setData(null)
    try {
      const res = await fetch(`/api/reports/daily?date=${d}`)
      if (res.ok) {
        const json = await res.json()
        if (json.ok) setData({
          date:            json.date,
          rate:            json.rate,
          salesCount:      json.sales_count,
          totalUsd:        json.total_usd,
          totalBs:         json.total_bs,
          byPaymentMethod: json.by_payment_method ?? [],
          topProducts: (json.top_products ?? []).map((p: {
            product_id: number; name: string; quantity: number; total_usd: number; total_bs: number
          }) => ({
            productId: p.product_id,
            name:      p.name,
            quantity:  p.quantity,
            totalUsd:  p.total_usd,
            totalBs:   p.total_bs,
          })),
        })
        else toast('Error al cargar el reporte', 'error')
      } else {
        toast('Error al cargar el reporte', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    fetchDaily(todayStr())
  }, [fetchDaily])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value
    setDate(d)
    fetchDaily(d)
  }

  const handleExport = useCallback(async () => {
    if (!data || data.salesCount === 0) {
      toast('No hay ventas en este día', 'error')
      return
    }
    setExporting(true)
    try {
      const { generateDailyReportPdf } = await import('@/lib/pdf-reports')
      await generateDailyReportPdf({
        date:            data.date,
        businessName,
        rate:            data.rate,
        salesCount:      data.salesCount,
        totalUsd:        data.totalUsd,
        totalBs:         data.totalBs,
        byPaymentMethod: data.byPaymentMethod,
        topProducts:     data.topProducts,
      })
      toast('PDF generado', 'success')
    } catch {
      toast('Error al generar el PDF', 'error')
    } finally {
      setExporting(false)
    }
  }, [data, toast])

  const handleExportExcel = useCallback(async () => {
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/reports/export-excel?date=${date}`)
      if (!res.ok) { toast('Error al exportar', 'error'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `reporte-${date}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Error al exportar', 'error')
    } finally {
      setExportingExcel(false)
    }
  }, [date, toast])

  const fetchRange = useCallback(async (from: string, to: string) => {
    if (!from || !to || from > to) {
      toast('Selecciona un rango de fechas válido', 'error')
      return
    }
    setRangeLoading(true)
    setRangeData(null)
    try {
      const res = await fetch(`/api/reports/range?from=${from}&to=${to}`)
      if (res.ok) {
        const json = await res.json()
        if (json.ok) {
          setRangeData({
            from,
            to,
            rate:            json.rate            ?? 0,
            salesCount:      json.sales_count     ?? 0,
            totalUsd:        json.total_usd       ?? 0,
            totalBs:         json.total_bs        ?? 0,
            byPaymentMethod: json.by_payment_method ?? [],
            topProducts: (json.top_products ?? []).map((p: {
              product_id: number; name: string; quantity: number; total_usd: number; total_bs: number
            }) => ({
              productId: p.product_id,
              name:      p.name,
              quantity:  p.quantity,
              totalUsd:  p.total_usd,
              totalBs:   p.total_bs,
            })),
          })
          setRangeMode(true)
          setRangeOpen(false)
        } else {
          toast('Error al cargar el rango', 'error')
        }
      } else {
        toast('Error al cargar el rango', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setRangeLoading(false)
    }
  }, [toast])

  const handleClearRange = () => {
    setRangeMode(false)
    setRangeData(null)
    setRangeOpen(false)
    setRangeFrom('')
    setRangeTo('')
  }

  const fmtRangeLabel = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })

  const { period, label: periodLabel } = prevMonthPeriod()

  /* Active display data — either range or daily */
  const activeData       = rangeMode ? rangeData       : data
  const activeLoading    = rangeMode ? rangeLoading    : loading
  const totalPayments    = activeData?.byPaymentMethod.reduce((s, p) => s + p.totalUsd, 0) ?? 0
  const maxPayment       = activeData ? Math.max(...activeData.byPaymentMethod.map(p => p.totalUsd), 0) : 0
  const avgTicket        = activeData && activeData.salesCount > 0
    ? activeData.totalUsd / activeData.salesCount : 0
  const activeRate       = activeData?.rate ?? 1

  return (
    <div className={`${styles.page} page-container`}>

      {/* Monthly banner */}
      <MonthlyReportBanner period={period} periodLabel={periodLabel} />

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {rangeMode ? 'Reporte por Rango' : 'Reporte Diario'}
          </h1>
          {rangeMode && rangeData ? (
            <p className={styles.rangeIndicator}>
              <CalendarRange size={13} aria-hidden="true" />
              Mostrando: {fmtRangeLabel(rangeData.from)} — {fmtRangeLabel(rangeData.to)}
              <button
                type="button"
                className={styles.rangeClearBtn}
                onClick={handleClearRange}
                aria-label="Volver a reporte diario"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </p>
          ) : (
            <p className={styles.pageSubtitle}>Resumen de ventas, métodos de pago y productos del día.</p>
          )}
        </div>
        <div className={styles.headerActions}>
          {!rangeMode && (
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={handleDateChange}
              className={styles.dateInput}
              aria-label="Seleccionar fecha"
            />
          )}
          <Button
            variant={rangeOpen ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<CalendarRange size={14} aria-hidden="true" />}
            onClick={() => { if (rangeMode) handleClearRange(); else setRangeOpen(o => !o) }}
            aria-pressed={rangeOpen || rangeMode}
          >
            {rangeMode ? 'Limpiar rango' : 'Rango personalizado'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
            onClick={handleExportExcel}
            loading={exportingExcel}
            disabled={!activeData || activeLoading}
            aria-label="Exportar Excel"
          >
            Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download size={14} aria-hidden="true" />}
            onClick={handleExport}
            loading={exporting}
            disabled={!data || data.salesCount === 0 || loading || rangeMode}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Range picker panel */}
      {rangeOpen && (
        <div className={styles.rangePanel}>
          <label className={styles.rangeLabel}>
            Desde
            <input
              type="date"
              value={rangeFrom}
              max={todayStr()}
              onChange={e => setRangeFrom(e.target.value)}
              className={styles.rangeDateInput}
              aria-label="Fecha de inicio del rango"
            />
          </label>
          <label className={styles.rangeLabel}>
            Hasta
            <input
              type="date"
              value={rangeTo}
              max={todayStr()}
              onChange={e => setRangeTo(e.target.value)}
              className={styles.rangeDateInput}
              aria-label="Fecha de fin del rango"
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void fetchRange(rangeFrom, rangeTo)}
            loading={rangeLoading}
            disabled={!rangeFrom || !rangeTo}
          >
            Aplicar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRangeOpen(false)}
          >
            Cancelar
          </Button>
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
          {/* KPI grid */}
          <div className={styles.kpiGrid}>
            <KpiCard
              icon={<BarChart2 size={18} aria-hidden="true" />}
              label={rangeMode ? 'Total del período' : 'Total del día'}
              primary={fmtUsd(activeData.totalUsd)}
              sub={fmtBs(activeData.totalBs)}
            />
            <KpiCard
              icon={<Package size={18} aria-hidden="true" />}
              label="Tickets cobrados"
              primary={String(activeData.salesCount)}
              sub={activeData.salesCount === 1 ? 'venta' : 'ventas'}
            />
            <KpiCard
              icon={<CreditCard size={18} aria-hidden="true" />}
              label="Ticket promedio"
              primary={fmtUsd(avgTicket)}
              sub={fmtBs(avgTicket * activeRate)}
            />
          </div>

          {/* Payment methods */}
          {activeData.byPaymentMethod.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Por método de pago</h2>
              <div className={styles.payList}>
                {[...activeData.byPaymentMethod]
                  .sort((a, b) => b.totalUsd - a.totalUsd)
                  .map(pm => (
                    <PayBar
                      key={pm.id}
                      name={pm.name}
                      totalUsd={pm.totalUsd}
                      maxUsd={maxPayment}
                      totalAll={totalPayments}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Top products table */}
          {activeData.topProducts.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>
                {rangeMode ? 'Top productos del período' : 'Top productos del día'}
              </h2>
              <div className={styles.tableScroll}>
                <table className={styles.reportTable}>
                  <thead>
                    <tr>
                      <th className={`${styles.th} ${styles.colProducto}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('name')}>
                          Producto
                          {prodSortKey === 'name' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colCant}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('quantity')}>
                          Cant.
                          {prodSortKey === 'quantity' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colPrecio}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('unit')}>
                          P. Unit.
                          {prodSortKey === 'unit' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.colTotal}`}>
                        <button type="button" className={styles.sortTh} onClick={() => handleProdSort('total')}>
                          Total
                          {prodSortKey === 'total' ? (prodSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeData.topProducts]
                      .sort((a, b) => {
                        if (!prodSortKey) return 0
                        const ua = a.quantity > 0 ? a.totalUsd / a.quantity : 0
                        const ub = b.quantity > 0 ? b.totalUsd / b.quantity : 0
                        let cmp = 0
                        if (prodSortKey === 'name')     cmp = a.name.localeCompare(b.name)
                        if (prodSortKey === 'quantity') cmp = a.quantity - b.quantity
                        if (prodSortKey === 'unit')     cmp = ua - ub
                        if (prodSortKey === 'total')    cmp = a.totalUsd - b.totalUsd
                        return prodSortDir === 'asc' ? cmp : -cmp
                      })
                      .map((p, i) => {
                        const unitUsd = p.quantity > 0 ? p.totalUsd / p.quantity : 0
                        return (
                          <tr key={p.productId} className={i % 2 === 1 ? styles.rowEven : ''}>
                            <td className={`${styles.td} ${styles.colProducto}`}>{p.name}</td>
                            <td className={`${styles.td} ${styles.colCant}`}>{p.quantity}</td>
                            <td className={`${styles.td} ${styles.colPrecio}`}>{fmtUsd(unitUsd)}</td>
                            <td className={`${styles.td} ${styles.colTotal}`}>
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
    </div>
  )
}

export default function ReportesPage() {
  return (
    <ToastProvider>
      <ReportesContent />
    </ToastProvider>
  )
}
