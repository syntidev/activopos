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
