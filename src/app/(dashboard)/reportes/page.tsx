'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Printer,
  SlidersHorizontal,
  ReceiptText,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './reportes.module.css'

/* ── Types ── */

interface SaleItem {
  id: number
  product_name: string
  quantity: number | string
  unit_price_usd: number | string
  total_usd: number | string
}

interface Payment {
  id: number
  amount_usd: number | string
  amount_bs: number | string
  payment_method: { id: number; name: string; type: string }
}

interface Sale {
  id: number
  status: 'quote' | 'pending' | 'paid' | 'cancelled'
  total_usd: number | string
  total_bs: number | string
  discount_amount?: number | string | null
  surcharge_amount?: number | string | null
  notes: string | null
  sold_at: string | null
  created_at: string
  rate_used?: number | string | null
  client: { id: number; name: string; phone: string | null } | null
  cashier: { id: number; name: string }
  items: SaleItem[]
  payments: Payment[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

type DatePreset = 'today' | '7d' | 'month'

/* ── Helpers ── */

const fmtUsd = (n: number | string) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number | string) =>
  `Bs ${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDatetime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const today = todayStr()
  if (preset === 'today') return { from: today, to: today }
  if (preset === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

const STATUS_LABEL: Record<string, string> = {
  paid:      'Pagado',
  pending:   'Crédito',
  quote:     'Cotización',
  cancelled: 'Anulado',
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    paid:      styles.badgePaid,
    pending:   styles.badgePending,
    quote:     styles.badgeQuote,
    cancelled: styles.badgeCancelled,
  }[status] ?? styles.badgeCancelled

  return <span className={`${styles.badge} ${cls}`}>{STATUS_LABEL[status] ?? status}</span>
}

/* ── Expandable sale row ── */

function SaleRow({
  sale,
  expanded,
  onToggle,
}: {
  sale: Sale
  expanded: boolean
  onToggle: () => void
}) {
  const discount  = Number(sale.discount_amount ?? 0)
  const surcharge = Number(sale.surcharge_amount ?? 0)
  const paymentNames = sale.payments.map((p) => p.payment_method.name).join(', ')

  return (
    <>
      <tr
        className={`${styles.row} ${expanded ? styles.rowExpanded : ''}`}
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        {/* Fecha */}
        <td className={styles.td}>
          <span className={styles.expandToggle}>
            <span className={styles.toggleIcon} aria-hidden="true">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className={styles.dateText}>{fmtDatetime(sale.sold_at ?? sale.created_at)}</span>
          </span>
        </td>

        {/* Orden ID */}
        <td className={styles.td}>
          <span className={styles.orderId}>#{sale.id}</span>
        </td>

        {/* Cliente */}
        <td className={styles.td}>
          {sale.client ? (
            sale.client.name
          ) : (
            <span className={styles.muted}>Contado</span>
          )}
        </td>

        {/* Método */}
        <td className={styles.td}>
          <span className={styles.methodCell}>{paymentNames || '—'}</span>
        </td>

        {/* Total USD */}
        <td className={`${styles.td} ${styles.alignRight}`}>
          <span className={styles.usdVal}>{fmtUsd(sale.total_usd)}</span>
        </td>

        {/* Desc. */}
        <td className={`${styles.td} ${styles.alignRight}`}>
          {discount > 0 ? (
            <span className={styles.discountVal}>−{fmtUsd(discount)}</span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>

        {/* Cargos */}
        <td className={`${styles.td} ${styles.alignRight}`}>
          {surcharge > 0 ? fmtUsd(surcharge) : <span className={styles.muted}>—</span>}
        </td>

        {/* Total Bs */}
        <td className={`${styles.td} ${styles.alignRight}`}>
          <span className={styles.bsVal}>{fmtBs(sale.total_bs)}</span>
        </td>

        {/* Notas */}
        <td className={styles.td}>
          <span className={styles.notesCell}>{sale.notes ?? '—'}</span>
        </td>

        {/* Estado (Utilidad) */}
        <td className={styles.td}>
          <StatusBadge status={sale.status} />
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className={styles.detailRow}>
          <td colSpan={10} className={styles.detailCell}>
            <div className={styles.detailGrid}>
              {/* Products */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Productos vendidos</p>
                {sale.items.length === 0 ? (
                  <p className={styles.muted}>Sin ítems registrados.</p>
                ) : (
                  <div className={styles.itemsList}>
                    {sale.items.map((item) => (
                      <div key={item.id} className={styles.itemRow}>
                        <span className={styles.itemName}>{item.product_name}</span>
                        <span className={styles.itemQty}>× {Number(item.quantity)}</span>
                        <span className={styles.itemUnitPrice}>{fmtUsd(item.unit_price_usd)} c/u</span>
                        <span className={styles.itemTotal}>{fmtUsd(item.total_usd)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className={styles.detailMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Cajero</span>
                  <span className={styles.metaValue}>{sale.cashier.name}</span>
                </div>
                {sale.rate_used && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Tasa BCV usada</span>
                    <span className={styles.metaValue}>
                      Bs {Number(sale.rate_used).toFixed(2)}
                    </span>
                  </div>
                )}
                {sale.payments.map((p) => (
                  <div key={p.id} className={styles.metaRow}>
                    <span className={styles.metaLabel}>{p.payment_method.name}</span>
                    <span className={styles.metaValue}>
                      {fmtUsd(p.amount_usd)} · {fmtBs(p.amount_bs)}
                    </span>
                  </div>
                ))}
                {sale.client?.phone && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Teléfono</span>
                    <span className={styles.metaValue}>{sale.client.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Pagination helper ── */

function buildPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

/* ── Main inner component ── */

function ReportesContent() {
  const { toast } = useToast()

  const [sales, setSales]         = useState<Sale[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [loading, setLoading]     = useState(false)
  const [activePreset, setActivePreset] = useState<DatePreset | null>('today')
  const [from, setFrom]           = useState(todayStr)
  const [to, setTo]               = useState(todayStr)
  const [page, setPage]           = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting]     = useState(false)
  const initRef = useRef(false)

  const fetchSales = useCallback(
    async (fromDate: string, toDate: string, p: number) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({ from: fromDate, to: toDate, page: String(p), limit: '20' })
        const res = await fetch(`/api/reports/sales?${qs}`)
        if (res.ok) {
          const data = await res.json()
          setSales(data.sales ?? [])
          setPagination(data.pagination)
        } else {
          toast('Error al cargar las ventas', 'error')
        }
      } catch {
        toast('Error de conexión', 'error')
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  /* Fetch on mount */
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const today = todayStr()
    fetchSales(today, today, 1)
  }, [fetchSales])

  const applyPreset = (preset: DatePreset) => {
    const dates = getPresetDates(preset)
    setActivePreset(preset)
    setFrom(dates.from)
    setTo(dates.to)
    setPage(1)
    setExpandedId(null)
    fetchSales(dates.from, dates.to, 1)
  }

  const applyCustomFilter = () => {
    setActivePreset(null)
    setPage(1)
    setExpandedId(null)
    fetchSales(from, to, 1)
    setShowFilters(false)
  }

  const goToPage = (p: number) => {
    setPage(p)
    setExpandedId(null)
    fetchSales(from, to, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: '7d',    label: '7 Días' },
    { key: 'month', label: 'Mes' },
  ]

  const handleExportPDF = useCallback(async () => {
    if (sales.length === 0) { toast('No hay datos para exportar', 'error'); return }
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pw        = doc.internal.pageSize.getWidth()
      const ph        = doc.internal.pageSize.getHeight()
      const m         = 15

      /* ── Header ── */
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('ActivoPOS — Historial de Ventas', m, 18)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Período: ${from} al ${to}`, m, 26)
      doc.text(`Total del período: ${pagination.total} ventas`, m, 31)
      if (pagination.pages > 1) {
        doc.text(`(Página ${page} de ${pagination.pages} — mostrando ${sales.length} de ${pagination.total})`, m, 36)
      }
      doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, pw - m, 26, { align: 'right' })

      /* ── Aggregate from loaded data ── */
      let totalPaidUsd = 0
      let totalPaidBs  = 0
      const byMethod:  Record<string, number>                    = {}
      const byProduct: Record<string, { qty: number; usd: number }> = {}

      for (const sale of sales) {
        if (sale.status === 'paid') {
          totalPaidUsd += Number(sale.total_usd)
          totalPaidBs  += Number(sale.total_bs)
        }
        for (const p of sale.payments) {
          const mn = p.payment_method.name
          byMethod[mn] = (byMethod[mn] ?? 0) + Number(p.amount_usd)
        }
        for (const item of sale.items) {
          const pn = item.product_name
          if (!byProduct[pn]) byProduct[pn] = { qty: 0, usd: 0 }
          byProduct[pn].qty += Number(item.quantity)
          byProduct[pn].usd += Number(item.total_usd)
        }
      }

      /* ── Table ── */
      const headers  = ['Fecha', 'Orden', 'Cliente', 'Método de pago', 'Total USD', 'Estado']
      const colW     = [40, 18, 55, 55, 30, 24]
      let y          = pagination.pages > 1 ? 44 : 39

      doc.setFillColor(30, 30, 30)
      doc.rect(m, y - 5, pw - m * 2, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')

      let x = m
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 2, y)
        x += colW[i]
      }

      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      y += 4

      for (let ri = 0; ri < sales.length; ri++) {
        const sale = sales[ri]
        if (y > ph - 40) { doc.addPage(); y = 20 }

        const dt     = sale.sold_at ?? sale.created_at
        const dateS  = dt ? new Date(dt).toLocaleDateString('es-VE') : '—'
        const client = sale.client?.name ?? 'Contado'
        const method = sale.payments.map(p => p.payment_method.name).join(', ') || '—'
        const status = STATUS_LABEL[sale.status] ?? sale.status

        if (ri % 2 === 0) {
          doc.setFillColor(246, 246, 248)
          doc.rect(m, y - 4, pw - m * 2, 6.5, 'F')
        }

        const cells = [dateS, `#${sale.id}`, client, method, `$${Number(sale.total_usd).toFixed(2)}`, status]
        x = m
        for (let i = 0; i < cells.length; i++) {
          const cell = String(cells[i])
          const max  = Math.floor(colW[i] / 1.8)
          doc.text(cell.length > max ? cell.slice(0, max - 1) + '…' : cell, x + 2, y)
          x += colW[i]
        }
        y += 6.5
      }

      /* ── Summary ── */
      y += 6
      if (y > ph - 50) { doc.addPage(); y = 20 }

      doc.setDrawColor(180, 180, 180)
      doc.line(m, y, pw - m, y)
      y += 5

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumen', m, y)
      y += 5

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total pagado: $${totalPaidUsd.toFixed(2)} · Bs. ${totalPaidBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, m, y)
      y += 5

      const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1])
      if (methods.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Métodos de pago:', m, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const [name, amt] of methods) {
          doc.text(`  ${name}: $${amt.toFixed(2)}`, m, y)
          y += 4
        }
        y += 2
      }

      const topProds = Object.entries(byProduct).sort((a, b) => b[1].usd - a[1].usd).slice(0, 5)
      if (topProds.length > 0) {
        if (y > ph - 30) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.text('Top productos:', m, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        for (const [name, data] of topProds) {
          doc.text(`  ${name}: ${Number(data.qty).toFixed(2)} und · $${data.usd.toFixed(2)}`, m, y)
          y += 4
        }
      }

      /* ── Save ── */
      const filename = `reporte_${to}.pdf`
      doc.save(filename)
      toast('PDF generado correctamente', 'success')
    } catch {
      toast('Error al generar el PDF', 'error')
    } finally {
      setExporting(false)
    }
  }, [sales, from, to, page, pagination, toast])

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Historial de Ventas</h1>
          <p className={styles.pageSubtitle}>Consulta, filtra y exporta tus transacciones.</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Printer size={14} aria-hidden="true" />}
            onClick={handleExportPDF}
            loading={exporting}
            disabled={sales.length === 0 || loading}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.presetGroup}>
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.presetPill} ${activePreset === key ? styles.presetPillActive : ''}`}
              onClick={() => applyPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtros
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={showFilters ? styles.chevronUp : ''}
          />
        </button>
      </div>

      {/* Custom date filters */}
      {showFilters && (
        <div className={styles.customFilters}>
          <label className={styles.customFilterLabel}>
            <span className={styles.customFilterLabelText}>Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(null) }}
              className={styles.dateInput}
            />
          </label>
          <label className={styles.customFilterLabel}>
            <span className={styles.customFilterLabelText}>Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setActivePreset(null) }}
              className={styles.dateInput}
            />
          </label>
          <Button variant="primary" size="sm" onClick={applyCustomFilter}>
            Aplicar
          </Button>
        </div>
      )}

      {/* Summary */}
      {!loading && pagination.total > 0 && (
        <p className={styles.summary}>
          {pagination.total.toLocaleString('es-VE')} {pagination.total === 1 ? 'venta' : 'ventas'} ·
          Página {pagination.page} de {pagination.pages}
        </p>
      )}

      {/* Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingSpinner} aria-hidden="true" />
            <p className={styles.loadingText}>Cargando ventas...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className={styles.emptyState}>
            <ReceiptText size={32} aria-hidden="true" className={styles.emptyIcon} />
            <p>No hay ventas en el período seleccionado.</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Fecha</th>
                  <th className={styles.th}>Orden</th>
                  <th className={styles.th}>Cliente</th>
                  <th className={styles.th}>Método</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Total USD</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Desc.</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Cargos</th>
                  <th className={`${styles.th} ${styles.alignRight}`}>Total Bs</th>
                  <th className={styles.th}>Notas</th>
                  <th className={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <SaleRow
                    key={sale.id}
                    sale={sale}
                    expanded={expandedId === sale.id}
                    onToggle={() =>
                      setExpandedId((prev) => (prev === sale.id ? null : sale.id))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className={styles.pagination} role="navigation" aria-label="Paginación">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Anterior
          </Button>

          <div className={styles.pageNumbers}>
            {buildPages(page, pagination.pages).map((p, i) =>
              p === '...' ? (
                <span key={`ell-${i}`} className={styles.pageEllipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                  onClick={() => goToPage(p as number)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pagination.pages}
            onClick={() => goToPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
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
