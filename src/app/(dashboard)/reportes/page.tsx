'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, FileSpreadsheet, BarChart2, CreditCard, Package, ChevronUp, ChevronDown } from 'lucide-react'
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

function ReportesContent() {
  const { toast } = useToast()

  const [date,      setDate]      = useState<string>(todayStr)
  const [data,      setData]      = useState<DailyData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const initRef = useRef(false)

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
        businessName:    'Mi Negocio',  // placeholder — pendiente desde sesión
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

  const { period, label: periodLabel } = prevMonthPeriod()

  const totalPayments = data?.byPaymentMethod.reduce((s, p) => s + p.totalUsd, 0) ?? 0
  const maxPayment    = data
    ? Math.max(...data.byPaymentMethod.map(p => p.totalUsd), 0)
    : 0
  const avgTicket = data && data.salesCount > 0
    ? data.totalUsd / data.salesCount
    : 0

  return (
    <div className={`${styles.page} page-container`}>

      {/* Monthly banner */}
      <MonthlyReportBanner period={period} periodLabel={periodLabel} />

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reporte Diario</h1>
          <p className={styles.pageSubtitle}>Resumen de ventas, métodos de pago y productos del día.</p>
        </div>
        <div className={styles.headerActions}>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={handleDateChange}
            className={styles.dateInput}
            aria-label="Seleccionar fecha"
          />
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
            disabled
            title="Exportar Excel — próximamente"
          >
            Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download size={14} aria-hidden="true" />}
            onClick={handleExport}
            loading={exporting}
            disabled={!data || data.salesCount === 0 || loading}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <p>Cargando reporte…</p>
        </div>
      ) : !data ? (
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
              label="Total del día"
              primary={fmtUsd(data.totalUsd)}
              sub={fmtBs(data.totalBs)}
            />
            <KpiCard
              icon={<Package size={18} aria-hidden="true" />}
              label="Tickets cobrados"
              primary={String(data.salesCount)}
              sub={data.salesCount === 1 ? 'venta' : 'ventas'}
            />
            <KpiCard
              icon={<CreditCard size={18} aria-hidden="true" />}
              label="Ticket promedio"
              primary={fmtUsd(avgTicket)}
              sub={fmtBs(avgTicket * data.rate)}
            />
          </div>

          {/* Payment methods */}
          {data.byPaymentMethod.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Por método de pago</h2>
              <div className={styles.payList}>
                {[...data.byPaymentMethod]
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
          {data.topProducts.length > 0 && (
            <div className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Top productos del día</h2>
              <div className={styles.tableScroll}>
                <table className={styles.reportTable}>
                  <thead>
                    <tr>
                      <th className={`${styles.th} ${styles.colProducto}`}>Producto</th>
                      <th className={`${styles.th} ${styles.colCant}`}>Cant.</th>
                      <th className={`${styles.th} ${styles.colPrecio}`}>P. Unit.</th>
                      <th className={`${styles.th} ${styles.colTotal}`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, i) => {
                      const unitUsd = p.quantity > 0 ? p.totalUsd / p.quantity : 0
                      return (
                        <tr key={p.productId} className={i % 2 === 1 ? styles.rowEven : ''}>
                          <td className={`${styles.td} ${styles.colProducto}`}>
                            {p.name}
                          </td>
                          <td className={`${styles.td} ${styles.colCant}`}>
                            {p.quantity}
                          </td>
                          <td className={`${styles.td} ${styles.colPrecio}`}>
                            {fmtUsd(unitUsd)}
                          </td>
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

          {data.salesCount === 0 && (
            <div className={styles.emptyState}>
              <BarChart2 size={32} className={styles.emptyIcon} aria-hidden="true" />
              <p>Sin ventas registradas el {date}.</p>
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
