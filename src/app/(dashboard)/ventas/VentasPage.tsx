'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Search, X, ChevronUp, ChevronDown, ArrowUpDown,
  Receipt, User, Package, CreditCard, Hash,
  Printer, Trash2, ChevronLeft, ChevronRight, Loader2,
  AlertTriangle, Calendar,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './ventas.module.css'

/* ── Types ── */

type SaleStatus = 'draft' | 'quote' | 'pending' | 'paid' | 'cancelled' | 'credit'
type SortDir    = 'asc' | 'desc'
type SortKey    = 'ticket' | 'date' | 'client' | 'items' | 'total' | 'method' | 'status' | 'utilidad'
type Period     = 'today' | '7d' | 'month' | 'custom'
type StatusFilt = '' | 'paid' | 'pending' | 'cancelled'

interface SaleItemRow {
  id:                 number
  product_name:       string
  quantity:           number
  price_per_unit_usd: number
  subtotal_usd:       number
  subtotal_bs:        number
  discount_usd:       number
  unit_label:         string | null
}

interface SalePaymentRow {
  id:             number
  amount_usd:     number
  amount_bs:      number
  reference:      string | null
  payment_method: { id: number; name: string; type: string }
}

interface SaleRow {
  id:            number
  ticket_number: string
  status:        SaleStatus
  origin:        string
  total_usd:     number
  total_bs:      number
  rate_used:     number
  created_at:    string
  sold_at:       string | null
  notes:         string | null
  client_name:   string | null
  client:        { id: number; name: string; phone: string | null } | null
  cashier:       { id: number; name: string } | null
  items:         SaleItemRow[]
  payments:      SalePaymentRow[]
  /** Ausente en la respuesta para cashier (despojado server-side, ver d56598c) */
  utilidad_usd?: number | null
}

/* ── Helpers ── */

const STATUS_LABELS: Record<SaleStatus, string> = {
  draft:     'Borrador',
  quote:     'Cotización',
  pending:   'Crédito',
  credit:    'Crédito',
  paid:      'Pagado',
  cancelled: 'Anulado',
}

const STATUS_VARIANT: Record<SaleStatus, BadgeVariant> = {
  draft:     'info',
  quote:     'info',
  pending:   'warning',
  credit:    'warning',
  paid:      'success',
  cancelled: 'danger',
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  '7d':  '7 días',
  month: 'Este mes',
  custom: 'Personalizado',
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function periodDates(p: Period): { from: string; to: string } {
  const today = todayStr()
  if (p === 'today') return { from: today, to: today }
  if (p === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  if (p === 'month') {
    const d = new Date()
    d.setDate(1)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  return { from: '', to: '' }
}

const fmtUsd = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBs = (n: number) =>
  `Bs. ${Math.abs(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDate(d: string | null, short = false): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-VE', short
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' }
  )
}

function fmtTime(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function clientName(s: SaleRow): string {
  return s.client?.name ?? s.client_name ?? '—'
}

function primaryPayment(s: SaleRow): string {
  if (s.status === 'credit') return 'Crédito'
  if (s.payments.length === 0) return '—'
  if (s.payments.length === 1) return s.payments[0].payment_method.name
  return `${s.payments[0].payment_method.name} +${s.payments.length - 1}`
}

function sortSales(sales: SaleRow[], key: SortKey | null, dir: SortDir): SaleRow[] {
  if (!key) return sales
  return [...sales].sort((a, b) => {
    let cmp = 0
    if (key === 'ticket') cmp = a.ticket_number.localeCompare(b.ticket_number)
    if (key === 'date')   cmp = new Date(a.sold_at ?? a.created_at).getTime() - new Date(b.sold_at ?? b.created_at).getTime()
    if (key === 'client') cmp = clientName(a).localeCompare(clientName(b))
    if (key === 'items')  cmp = a.items.length - b.items.length
    if (key === 'total')  cmp = a.total_usd - b.total_usd
    if (key === 'method') cmp = primaryPayment(a).localeCompare(primaryPayment(b))
    if (key === 'status') cmp = a.status.localeCompare(b.status)
    if (key === 'utilidad') cmp = (a.utilidad_usd ?? -Infinity) - (b.utilidad_usd ?? -Infinity)
    return dir === 'asc' ? cmp : -cmp
  })
}

/* ── SortTh ── */

function SortTh({ label, col, current, dir, onClick }: {
  label:   string
  col:     SortKey
  current: SortKey | null
  dir:     SortDir
  onClick: (k: SortKey) => void
}) {
  const active = current === col
  return (
    <th className={styles.th}>
      <button type="button" className={styles.sortBtn} onClick={() => onClick(col)}>
        {label}
        {active
          ? (dir === 'asc'
              ? <ChevronUp  size={11} aria-hidden="true" />
              : <ChevronDown size={11} aria-hidden="true" />)
          : <ArrowUpDown size={11} className={styles.sortIdle} aria-hidden="true" />
        }
      </button>
    </th>
  )
}

/* ── Main component ── */

interface VentasContentProps { isAdmin: boolean }

function VentasContent({ isAdmin }: VentasContentProps) {
  const { toast } = useToast()

  /* ── Filter state ── */
  const [search,      setSearch]      = useState('')
  const [debSearch,   setDebSearch]   = useState('')
  const [period,      setPeriod]      = useState<Period>('today')
  const [statusFilt,  setStatusFilt]  = useState<StatusFilt>('')
  const [fromDate,    setFromDate]    = useState(() => todayStr())
  const [toDate,      setToDate]      = useState(() => todayStr())
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [showCustom,  setShowCustom]  = useState(false)

  /* ── Data state ── */
  const [sales,   setSales]   = useState<SaleRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  /* ── Sort ── */
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  /* ── Detail panel ── */
  const [selected,    setSelected]   = useState<SaleRow | null>(null)
  const [voidOpen,    setVoidOpen]   = useState(false)
  const [voidReason,  setVoidReason] = useState('')
  const [voiding,     setVoiding]    = useState(false)

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Debounce search ── */
  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => setDebSearch(search), 400)
    return () => { if (debTimer.current) clearTimeout(debTimer.current) }
  }, [search])

  /* ── Period → dates ── */
  useEffect(() => {
    if (period === 'custom') return
    const { from, to } = periodDates(period)
    setFromDate(from)
    setToDate(to)
  }, [period])

  /* ── Fetch ── */
  const fetchSales = useCallback(async (p: number) => {
    if (!fromDate || !toDate) return
    setLoading(true)
    try {
      const q = new URLSearchParams({
        page:           String(p),
        limit:          '20',
        use_created_at: '1',
        from:           fromDate,
        to:             toDate,
        ...(statusFilt  ? { status: statusFilt }  : {}),
        ...(debSearch   ? { search: debSearch }   : {}),
      })
      const res  = await fetch(`/api/sales?${q.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as {
        ok: boolean; sales: SaleRow[]; total: number; pages: number; page: number
      }
      if (json.ok) {
        setSales(json.sales)
        setTotal(json.total)
        setPages(json.pages)
      }
    } catch {
      toast('Error al cargar las ventas', 'error')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, statusFilt, debSearch, toast])

  useEffect(() => {
    setPage(1)
    void fetchSales(1)
  }, [fetchSales])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => sortSales(sales, sortKey, sortDir), [sales, sortKey, sortDir])

  const handlePageChange = (p: number) => {
    setPage(p)
    void fetchSales(p)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    setFromDate(customFrom)
    setToDate(customTo)
    setShowCustom(false)
  }

  const handleSelectRow = (sale: SaleRow) => {
    if (selected?.id === sale.id) {
      setSelected(null)
      setVoidOpen(false)
    } else {
      setSelected(sale)
      setVoidOpen(false)
      setVoidReason('')
    }
  }

  const handleVoid = async () => {
    if (!selected) return
    setVoiding(true)
    try {
      const res  = await fetch(`/api/sales/${selected.id}/void`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: voidReason }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) { toast(body.error ?? 'Error al anular la venta', 'error'); return }
      toast('Venta anulada correctamente', 'success')
      setSelected(null)
      setVoidOpen(false)
      setVoidReason('')
      void fetchSales(page)
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className={styles.root}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Historial de Ventas</h1>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            placeholder="Ticket, cliente o método de pago…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Buscar ventas"
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar — período / estado en filas separadas ── */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.chipGroup} role="group" aria-label="Período">
            {(['today', '7d', 'month', 'custom'] as Period[]).map(p => (
              <button
                key={p}
                type="button"
                className={`${styles.chip} ${period === p ? styles.chipActive : ''}`}
                onClick={() => {
                  setPeriod(p)
                  if (p === 'custom') setShowCustom(true)
                  else setShowCustom(false)
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {total > 0 && !loading && (
            <span className={styles.totalBadge}>{total} resultado{total !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className={styles.filterRow}>
          <div className={styles.chipGroup} role="group" aria-label="Estado">
            {([
              { value: '' as StatusFilt, label: 'Todos', activeClass: styles.chipActive },
              { value: 'paid' as StatusFilt, label: 'Pagado', activeClass: styles.chipActivePaid },
              { value: 'pending' as StatusFilt, label: 'Crédito', activeClass: styles.chipActivePending },
              { value: 'cancelled' as StatusFilt, label: 'Cancelado', activeClass: styles.chipActiveCancelled },
            ]).map(({ value, label, activeClass }) => (
              <button
                key={value || 'all'}
                type="button"
                className={`${styles.chip} ${statusFilt === value ? activeClass : ''}`}
                onClick={() => setStatusFilt(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom range picker */}
      {period === 'custom' && showCustom && (
        <div className={styles.customRange}>
          <label className={styles.rangeLabel}>
            <Calendar size={13} aria-hidden="true" />
            Desde
            <input
              type="date"
              value={customFrom}
              max={todayStr()}
              onChange={e => setCustomFrom(e.target.value)}
              className={styles.dateInput}
              aria-label="Fecha de inicio"
            />
          </label>
          <label className={styles.rangeLabel}>
            <Calendar size={13} aria-hidden="true" />
            Hasta
            <input
              type="date"
              value={customTo}
              max={todayStr()}
              onChange={e => setCustomTo(e.target.value)}
              className={styles.dateInput}
              aria-label="Fecha de fin"
            />
          </label>
          <Button size="sm" variant="primary" onClick={applyCustom} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPeriod('today'); setShowCustom(false) }}>
            Cancelar
          </Button>
        </div>
      )}

      {/* ── Content area ── */}
      <div className={styles.contentArea}>

        {/* Table region */}
        <div className={styles.tableRegion}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinner} aria-hidden="true" />
              <p>Cargando ventas…</p>
            </div>
          ) : sales.length === 0 ? (
            <div className={styles.emptyState}>
              <Receipt size={36} className={styles.emptyIcon} aria-hidden="true" />
              <p className={styles.emptyTitle}>No hay ventas en este período</p>
              <p className={styles.emptySub}>Prueba con otro rango de fechas o cambia los filtros.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableScroll} role="region" aria-label="Tabla de ventas" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortTh label="Ticket"  col="ticket" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Fecha"   col="date"   current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Cliente" col="client" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Ítems"   col="items"  current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Total"   col="total"  current={sortKey} dir={sortDir} onClick={handleSort} />
                      {isAdmin && (
                        <SortTh label="Utilidad" col="utilidad" current={sortKey} dir={sortDir} onClick={handleSort} />
                      )}
                      <SortTh label="Método"  col="method" current={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortTh label="Estado"  col="status" current={sortKey} dir={sortDir} onClick={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(sale => (
                      <tr
                        key={sale.id}
                        className={`${styles.row} ${selected?.id === sale.id ? styles.rowSelected : ''}`}
                        onClick={() => handleSelectRow(sale)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRow(sale) } }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selected?.id === sale.id}
                        aria-label={`Venta ${sale.ticket_number} — ${fmtUsd(sale.total_usd)}`}
                      >
                        <td className={styles.td}>
                          <span className={styles.ticketNum}>
                            <Hash size={11} aria-hidden="true" />
                            {sale.ticket_number}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.dateCell}>
                            {fmtDate(sale.sold_at ?? sale.created_at, true)}
                            <span className={styles.timeCell}>
                              {fmtTime(sale.sold_at ?? sale.created_at)}
                            </span>
                          </span>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.clientCell}>{clientName(sale)}</span>
                        </td>
                        <td className={`${styles.td} ${styles.tdCenter}`}>
                          <span className={styles.itemCount}>{sale.items.length}</span>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.totalCell}>{fmtUsd(sale.total_usd)}</span>
                        </td>
                        {isAdmin && (
                          <td className={styles.td}>
                            {sale.utilidad_usd == null ? (
                              <span className={styles.utilidadNull}>—</span>
                            ) : (
                              <span className={sale.utilidad_usd >= 0 ? styles.utilidadPos : styles.utilidadNeg}>
                                {sale.utilidad_usd < 0 ? '−' : ''}{fmtUsd(sale.utilidad_usd)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className={styles.td}>
                          <span className={styles.methodCell}>{primaryPayment(sale)}</span>
                        </td>
                        <td className={styles.td}>
                          <Badge variant={STATUS_VARIANT[sale.status]} size="sm">
                            {STATUS_LABELS[sale.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <span className={styles.pageInfo}>
                    {page} / {pages}
                  </span>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pages}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Detail panel ── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div
                className={styles.backdrop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => { if (!voidOpen) { setSelected(null); setVoidOpen(false) } }}
                aria-hidden="true"
              />
              <motion.aside
                className={styles.panel}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
                aria-label="Detalle de venta"
              >
                {/* Panel header */}
                <div className={styles.panelHeader}>
                  <div className={styles.panelHeaderLeft}>
                    <h2 className={styles.panelTitle}>
                      <Hash size={14} aria-hidden="true" />
                      {selected.ticket_number}
                    </h2>
                    <p className={styles.panelDate}>
                      {fmtDate(selected.sold_at ?? selected.created_at)} · {fmtTime(selected.sold_at ?? selected.created_at)}
                    </p>
                  </div>
                  <div className={styles.panelHeaderRight}>
                    <Badge variant={STATUS_VARIANT[selected.status]}>
                      {STATUS_LABELS[selected.status]}
                    </Badge>
                    <button
                      type="button"
                      className={styles.closeBtn}
                      onClick={() => { setSelected(null); setVoidOpen(false); setVoidReason('') }}
                      aria-label="Cerrar detalle"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className={styles.panelBody}>

                  {/* Meta */}
                  <div className={styles.panelMeta}>
                    {selected.cashier && (
                      <div className={styles.metaRow}>
                        <User size={12} aria-hidden="true" />
                        <span>Cajero: <strong>{selected.cashier.name}</strong></span>
                      </div>
                    )}
                    {(selected.client ?? selected.client_name) && (
                      <div className={styles.metaRow}>
                        <User size={12} aria-hidden="true" />
                        <span>Cliente: <strong>{clientName(selected)}</strong></span>
                      </div>
                    )}
                    {selected.notes && (
                      <p className={styles.notesText}>{selected.notes}</p>
                    )}
                  </div>

                  <div className={styles.panelDivider} />

                  {/* Items */}
                  <div className={styles.section}>
                    <p className={styles.sectionLabel}>
                      <Package size={13} aria-hidden="true" />
                      Ítems ({selected.items.length})
                    </p>
                    <ul className={styles.itemsList} role="list">
                      {selected.items.map(item => (
                        <li key={item.id} className={styles.itemRow}>
                          <div className={styles.itemLeft}>
                            <span className={styles.itemName}>{item.product_name}</span>
                            <span className={styles.itemQty}>
                              × {item.quantity}{item.unit_label ? ` ${item.unit_label}` : ''}
                            </span>
                          </div>
                          <div className={styles.itemRight}>
                            {item.discount_usd > 0 && (
                              <span className={styles.itemDiscount}>−{fmtUsd(item.discount_usd)}</span>
                            )}
                            <span className={styles.itemSubtotal}>{fmtUsd(item.subtotal_usd)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.panelDivider} />

                  {/* Totals */}
                  <div className={styles.totalsSection}>
                    <div className={styles.totalRow}>
                      <span>Subtotal</span>
                      <span>{fmtUsd(selected.items.reduce((s, i) => s + i.subtotal_usd, 0))}</span>
                    </div>
                    <div className={`${styles.totalRow} ${styles.totalRowBig}`}>
                      <span>Total</span>
                      <span className={styles.totalUsd}>{fmtUsd(selected.total_usd)}</span>
                    </div>
                    <div className={styles.totalRow}>
                      <span className={styles.bsLabel}>Bolívares</span>
                      <span className={styles.totalBs}>{fmtBs(selected.total_bs)}</span>
                    </div>
                    <div className={styles.totalRow}>
                      <span className={styles.rateLabel}>Tasa BCV</span>
                      <span className={styles.rateValue}>
                        {selected.rate_used.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/$
                      </span>
                    </div>
                  </div>

                  {/* Payments */}
                  {selected.payments.length > 0 && (
                    <>
                      <div className={styles.panelDivider} />
                      <div className={styles.section}>
                        <p className={styles.sectionLabel}>
                          <CreditCard size={13} aria-hidden="true" />
                          Métodos de pago
                        </p>
                        <ul className={styles.paymentsList} role="list">
                          {selected.payments.map(p => (
                            <li key={p.id} className={styles.paymentRow}>
                              <span className={styles.paymentMethod}>{p.payment_method.name}</span>
                              {p.reference && (
                                <span className={styles.paymentRef}>#{p.reference}</span>
                              )}
                              <span className={styles.paymentAmt}>{fmtUsd(p.amount_usd)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  <div className={styles.panelDivider} />

                  {/* Actions */}
                  <div className={styles.actionsSection}>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Printer size={14} aria-hidden="true" />}
                      onClick={() => window.open(`/api/sales/${selected.id}/ticket`, '_blank')}
                    >
                      Reimprimir ticket
                    </Button>

                    {isAdmin && selected.status !== 'cancelled' && !voidOpen && (
                      <button
                        type="button"
                        className={styles.voidTrigger}
                        onClick={() => setVoidOpen(true)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Anular venta
                      </button>
                    )}
                  </div>

                  {/* Void form */}
                  {voidOpen && (
                    <div className={styles.voidForm}>
                      <div className={styles.voidWarning}>
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>Esta acción no se puede deshacer.</span>
                      </div>
                      <Input
                        label="Motivo de anulación"
                        placeholder="Mínimo 10 caracteres…"
                        value={voidReason}
                        onChange={e => setVoidReason(e.target.value)}
                        hint={`${voidReason.trim().length}/10 mínimo`}
                        required
                      />
                      <div className={styles.voidActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setVoidOpen(false); setVoidReason('') }}
                          disabled={voiding}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => { void handleVoid() }}
                          loading={voiding}
                          disabled={voidReason.trim().length < 10}
                        >
                          Confirmar anulación
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

/* ── Export ── */

export function VentasPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <ToastProvider>
      <VentasContent isAdmin={isAdmin} />
    </ToastProvider>
  )
}
