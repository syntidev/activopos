'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine, ChevronLeft, ChevronRight, Clock, FileDown,
  Package, Plus, Search, X,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './inventario.module.css'

/* ── Types ── */

interface Product {
  id: number
  name: string
  base_unit_label: string
  sale_mode: string
  price_per_unit_usd: number | null
  cost_per_unit_usd: number | null
  stock: { net_qty: number }
}

interface InventoryEntry {
  id: number
  quantity: number
  waste: number
  cost_per_unit_usd: number | null
  supplier: string | null
  notes: string | null
  entered_at: string
  product: { id: number; name: string; base_unit_label: string }
  user: { id: number; name: string } | null
}

type EntryType = 'all' | 'entrada' | 'ajuste'

/* ── Helpers ── */

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  const h = Math.floor(diff / 3600)
  if (h < 24)      return `${h}h`
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getEntryType(e: InventoryEntry): 'entrada' | 'ajuste' {
  return e.waste > 0 ? 'ajuste' : 'entrada'
}

const PAGE_SIZE = 20

/* ── Entry modal ── */

interface ModalProps {
  product: Product | null
  onClose: () => void
  onSaved: (entry: InventoryEntry) => void
}

function EntryModal({ product, onClose, onSaved }: ModalProps) {
  const { toast } = useToast()
  const [qty, setQty]           = useState('')
  const [cost, setCost]         = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<Record<string, string>>({})

  const isWeight = product?.sale_mode === 'weight'

  function validate(): boolean {
    const e: Record<string, string> = {}
    const q = parseFloat(qty)
    if (!qty.trim())               e.qty = 'La cantidad es requerida'
    else if (isNaN(q) || q <= 0)  e.qty = 'Cantidad inválida'
    else if (!isWeight && !Number.isInteger(q)) e.qty = 'Debe ser un número entero'
    if (cost.trim() && (isNaN(parseFloat(cost)) || parseFloat(cost) < 0)) e.cost = 'Costo inválido'
    setErr(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product || !validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:        product.id,
          quantity:          parseFloat(qty),
          cost_per_unit_usd: cost.trim() ? parseFloat(cost) : null,
          supplier:          supplier.trim() || null,
          notes:             notes.trim() || null,
        }),
      })
      const data = await res.json() as { ok?: boolean; entry?: InventoryEntry; error?: string }
      if (res.ok && data.entry) {
        onSaved(data.entry)
        toast(`Entrada registrada: +${parseFloat(qty).toFixed(isWeight ? 3 : 0)} ${product.base_unit_label}`, 'success')
      } else {
        toast(data.error ?? 'Error al registrar', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!product) return null

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
        role="dialog"
        aria-modal="true"
        aria-label={`Registrar entrada: ${product.name}`}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>{product.name}</h2>
              <p className={styles.modalSub}>Registrar entrada de stock</p>
            </div>
            <button
              className={styles.modalClose}
              onClick={onClose}
              disabled={saving}
              aria-label="Cerrar"
              type="button"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.stockPill}>
            <Package size={12} aria-hidden="true" />
            Stock actual:&nbsp;
            <strong>
              {product.stock.net_qty.toFixed(isWeight ? 3 : 0)}&nbsp;{product.base_unit_label}
            </strong>
          </div>

          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.field}>
              <label htmlFor="inv-qty" className={styles.label}>
                Cantidad ({product.base_unit_label}) *
              </label>
              <input
                id="inv-qty"
                type="number"
                className={`${styles.input} ${err.qty ? styles.inputErr : ''}`}
                value={qty}
                onChange={e => { setQty(e.target.value); setErr(p => ({ ...p, qty: '' })) }}
                min="0"
                step={isWeight ? '0.001' : '1'}
                placeholder={isWeight ? '0.000' : '0'}
                autoFocus
                disabled={saving}
              />
              {err.qty && <p className={styles.fieldErr}>{err.qty}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="inv-cost" className={styles.label}>
                Costo / {product.base_unit_label} (USD)&ensp;
                <span className={styles.optional}>opcional</span>
              </label>
              <input
                id="inv-cost"
                type="number"
                className={`${styles.input} ${err.cost ? styles.inputErr : ''}`}
                value={cost}
                onChange={e => { setCost(e.target.value); setErr(p => ({ ...p, cost: '' })) }}
                min="0"
                step="0.001"
                placeholder={product.cost_per_unit_usd != null
                  ? product.cost_per_unit_usd.toFixed(3)
                  : '0.000'}
                disabled={saving}
              />
              {err.cost && <p className={styles.fieldErr}>{err.cost}</p>}
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="inv-supplier" className={styles.label}>
                  Proveedor&ensp;<span className={styles.optional}>opcional</span>
                </label>
                <input
                  id="inv-supplier"
                  type="text"
                  className={styles.input}
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  maxLength={120}
                  placeholder="Nombre del proveedor"
                  disabled={saving}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="inv-notes" className={styles.label}>
                  Notas&ensp;<span className={styles.optional}>opcional</span>
                </label>
                <input
                  id="inv-notes"
                  type="text"
                  className={styles.input}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={300}
                  placeholder="Factura, referencia…"
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving || !qty.trim()}
              >
                {saving && <span className={styles.spinner} aria-hidden="true" />}
                {saving ? 'Guardando…' : 'Registrar entrada'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Main content ── */

function InventarioContent() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [entries, setEntries]   = useState<InventoryEntry[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)

  /* ── Historial filters ── */
  const [histSearch, setHistSearch] = useState('')
  const [histType, setHistType]     = useState<EntryType>('all')
  const [histFrom, setHistFrom]     = useState('')
  const [histTo, setHistTo]         = useState('')
  const [histPage, setHistPage]     = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [pRes, eRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/inventory'),
      ])
      if (pRes.ok) {
        const d = await pRes.json() as { products?: Product[] }
        setProducts(d.products ?? [])
      }
      if (eRes.ok) {
        const d = await eRes.json() as { entries?: InventoryEntry[] }
        setEntries(d.entries ?? [])
      }
    } catch {
      toast('Error al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Historial derived state ── */

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (histSearch && !e.product.name.toLowerCase().includes(histSearch.toLowerCase())) return false
      if (histType === 'entrada' && getEntryType(e) !== 'entrada') return false
      if (histType === 'ajuste'  && getEntryType(e) !== 'ajuste')  return false
      const day = e.entered_at.slice(0, 10)
      if (histFrom && day < histFrom) return false
      if (histTo   && day > histTo)   return false
      return true
    })
  }, [entries, histSearch, histType, histFrom, histTo])

  const totalPages    = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage      = Math.min(histPage, totalPages - 1)
  const paginatedEntries = filteredEntries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const totalEntradas = useMemo(() =>
    filteredEntries.filter(e => getEntryType(e) === 'entrada').reduce((s, e) => s + e.quantity, 0),
    [filteredEntries]
  )
  const totalAjustes = useMemo(() =>
    filteredEntries.filter(e => getEntryType(e) === 'ajuste').length,
    [filteredEntries]
  )
  const valorTotal = useMemo(() =>
    filteredEntries.reduce((s, e) => {
      if (e.cost_per_unit_usd != null) return s + e.quantity * e.cost_per_unit_usd
      return s
    }, 0),
    [filteredEntries]
  )

  function resetFilters() {
    setHistSearch('')
    setHistType('all')
    setHistFrom('')
    setHistTo('')
    setHistPage(0)
  }

  function buildExportUrl(): string {
    const p = new URLSearchParams()
    if (histSearch) p.set('search', histSearch)
    if (histType !== 'all') p.set('type', histType)
    if (histFrom) p.set('from', histFrom)
    if (histTo)   p.set('to', histTo)
    return `/api/inventory/export?${p.toString()}`
  }

  function handleSaved(entry: InventoryEntry) {
    setEntries(prev => [entry, ...prev])
    setProducts(prev =>
      prev.map(p =>
        p.id === entry.product.id
          ? { ...p, stock: { net_qty: p.stock.net_qty + entry.quantity } }
          : p
      )
    )
    setSelected(null)
  }

  function handleFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setHistPage(0) }
  }

  const hasActiveFilters = histSearch || histType !== 'all' || histFrom || histTo

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Inventario</h1>
          <p className={styles.pageSubtitle}>Registra entradas de stock para tus productos</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonWrap} aria-label="Cargando…">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : (
        <>
          {/* Products section */}
          <section className={styles.section}>
            <div className={styles.sectionBar}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} aria-hidden="true" />
                <input
                  type="search"
                  className={styles.searchInput}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                />
              </div>
              <span className={styles.countBadge}>{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <Package size={32} strokeWidth={1.25} aria-hidden="true" />
                <p>{search ? 'Sin resultados' : 'No hay productos activos'}</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label="Productos">
                  <thead className={styles.thead}>
                    <tr>
                      <th className={styles.th}>Producto</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Stock actual</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Costo / und</th>
                      <th className={styles.th} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const isW  = p.sale_mode === 'weight'
                      const low  = p.stock.net_qty <= 0
                      return (
                        <tr key={p.id} className={styles.tr}>
                          <td className={styles.td}>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productUnit}>{p.base_unit_label}</span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            <span className={low ? styles.stockLow : styles.stockOk}>
                              {p.stock.net_qty.toFixed(isW ? 3 : 0)}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            {p.cost_per_unit_usd != null
                              ? <span className={styles.price}>${p.cost_per_unit_usd.toFixed(3)}</span>
                              : <span className={styles.dash}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.tdAction}`}>
                            <button
                              className={styles.entradaBtn}
                              onClick={() => setSelected(p)}
                              type="button"
                              aria-label={`Registrar entrada para ${p.name}`}
                            >
                              <Plus size={13} aria-hidden="true" />
                              Entrada
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Historial section ── */}
          <section className={styles.section}>
            <div className={styles.histSectionBar}>
              <h2 className={styles.histSectionTitle}>
                <ArrowDownToLine size={15} aria-hidden="true" />
                Historial de movimientos
              </h2>
              <a
                href={buildExportUrl()}
                className={styles.exportBtn}
                download
                aria-label="Exportar historial a Excel"
              >
                <FileDown size={14} aria-hidden="true" />
                Exportar Excel
              </a>
            </div>

            {/* Filters */}
            <div className={styles.histFilters}>
              <div className={styles.histSearchWrap}>
                <Search size={13} className={styles.histSearchIcon} aria-hidden="true" />
                <input
                  type="search"
                  className={styles.histSearchInput}
                  value={histSearch}
                  onChange={e => handleFilterChange(setHistSearch)(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Filtrar historial por producto"
                />
              </div>
              <select
                className={styles.histSelect}
                value={histType}
                onChange={e => handleFilterChange(setHistType)(e.target.value as EntryType)}
                aria-label="Filtrar por tipo"
              >
                <option value="all">Todos los tipos</option>
                <option value="entrada">Entrada</option>
                <option value="ajuste">Ajuste / Merma</option>
              </select>
              <input
                type="date"
                className={styles.histDateInput}
                value={histFrom}
                onChange={e => handleFilterChange(setHistFrom)(e.target.value)}
                aria-label="Desde"
                title="Desde"
              />
              <input
                type="date"
                className={styles.histDateInput}
                value={histTo}
                onChange={e => handleFilterChange(setHistTo)(e.target.value)}
                aria-label="Hasta"
                title="Hasta"
              />
              {hasActiveFilters && (
                <button
                  className={styles.histClearBtn}
                  onClick={resetFilters}
                  type="button"
                  aria-label="Limpiar filtros"
                >
                  <X size={12} aria-hidden="true" />
                  Limpiar
                </button>
              )}
            </div>

            {paginatedEntries.length === 0 ? (
              <div className={styles.empty}>
                <ArrowDownToLine size={28} strokeWidth={1.25} aria-hidden="true" />
                <p>{hasActiveFilters ? 'Sin resultados para los filtros aplicados' : 'Aún no hay entradas registradas'}</p>
                {!hasActiveFilters && (
                  <p className={styles.emptyHint}>
                    Usa el botón&nbsp;<strong>Entrada</strong>&nbsp;en cualquier producto para comenzar
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table} aria-label="Historial de movimientos">
                    <thead className={styles.thead}>
                      <tr>
                        <th className={styles.th}>Fecha</th>
                        <th className={styles.th}>Producto</th>
                        <th className={styles.th}>Tipo</th>
                        <th className={`${styles.th} ${styles.thNum}`}>Cantidad</th>
                        <th className={`${styles.th} ${styles.thNum}`}>Costo / u</th>
                        <th className={styles.th}>Proveedor</th>
                        <th className={styles.th}>Notas</th>
                        <th className={styles.th}>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEntries.map(e => {
                        const type     = getEntryType(e)
                        const isWeight = e.product.base_unit_label !== 'und'
                        const qty      = type === 'ajuste'
                          ? `-${e.waste.toFixed(isWeight ? 3 : 0)}`
                          : `+${e.quantity.toFixed(isWeight ? 3 : 0)}`
                        return (
                          <tr key={e.id} className={styles.tr}>
                            <td className={styles.td}>
                              <span className={styles.timeCell}>
                                <Clock size={10} aria-hidden="true" />
                                {formatDate(e.entered_at)}
                              </span>
                            </td>
                            <td className={styles.td}>
                              <span className={styles.productName}>{e.product.name}</span>
                              <span className={styles.productUnit}>{e.product.base_unit_label}</span>
                            </td>
                            <td className={styles.td}>
                              <span className={type === 'entrada' ? styles.typeBadgeEntrada : styles.typeBadgeAjuste}>
                                {type === 'entrada' ? 'Entrada' : 'Ajuste'}
                              </span>
                            </td>
                            <td className={`${styles.td} ${styles.tdNum}`}>
                              <span className={type === 'entrada' ? styles.stockOk : styles.stockLow}>
                                {qty}&nbsp;{e.product.base_unit_label}
                              </span>
                            </td>
                            <td className={`${styles.td} ${styles.tdNum}`}>
                              {e.cost_per_unit_usd != null
                                ? <span className={styles.price}>${e.cost_per_unit_usd.toFixed(3)}</span>
                                : <span className={styles.dash}>—</span>}
                            </td>
                            <td className={styles.td}>
                              <span className={e.supplier ? styles.supplier : styles.dash}>
                                {e.supplier ?? '—'}
                              </span>
                            </td>
                            <td className={styles.td}>
                              <span className={styles.noteCell} title={e.notes ?? undefined}>
                                {e.notes ?? <span className={styles.dash}>—</span>}
                              </span>
                            </td>
                            <td className={styles.td}>
                              <span className={styles.userCell}>
                                {e.user?.name ?? '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className={styles.totalsBar}>
                  <div className={styles.totalItem}>
                    <span className={styles.totalLabel}>Entradas del período</span>
                    <span className={styles.totalValueGreen}>+{totalEntradas.toFixed(0)} und</span>
                  </div>
                  <div className={styles.totalDivider} aria-hidden="true" />
                  <div className={styles.totalItem}>
                    <span className={styles.totalLabel}>Ajustes registrados</span>
                    <span className={styles.totalValue}>{totalAjustes}</span>
                  </div>
                  <div className={styles.totalDivider} aria-hidden="true" />
                  <div className={styles.totalItem}>
                    <span className={styles.totalLabel}>Valor total inventariado</span>
                    <span className={styles.totalValue}>${valorTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.paginationBar}>
                    <button
                      className={styles.paginBtn}
                      onClick={() => setHistPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      type="button"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      Anterior
                    </button>
                    <span className={styles.paginInfo}>
                      Pág.&nbsp;{safePage + 1}&nbsp;de&nbsp;{totalPages}
                      &nbsp;·&nbsp;{filteredEntries.length} registros
                    </span>
                    <button
                      className={styles.paginBtn}
                      onClick={() => setHistPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      type="button"
                      aria-label="Página siguiente"
                    >
                      Siguiente
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {selected && (
        <EntryModal
          product={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

/* ── Page export ── */

export default function InventarioPage() {
  return (
    <ToastProvider>
      <InventarioContent />
    </ToastProvider>
  )
}
