'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowDownToLine, ChevronLeft, ChevronRight,
  Clock, DollarSign, FileDown, Layers, Package, Plus, ScanBarcode,
  Search, X,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { useScanner } from '@/hooks/useScanner'
import styles from './inventario.module.css'

/* ── Types ── */

interface Product {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  base_unit_label: string
  sale_mode: string
  price_per_unit_usd: number | null
  cost_per_unit_usd: number | null
  min_stock: number
  is_low_stock: boolean
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
type StockStatus = 'ok' | 'low' | 'out'

/* ── Helpers ── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function getEntryType(e: InventoryEntry): 'entrada' | 'ajuste' {
  return e.waste > 0 ? 'ajuste' : 'entrada'
}

function getStockStatus(p: Product): StockStatus {
  if (p.stock.net_qty <= 0) return 'out'
  if (p.is_low_stock || (p.min_stock > 0 && p.stock.net_qty <= p.min_stock)) return 'low'
  return 'ok'
}

const STOCK_STATUS_LABEL: Record<StockStatus, string> = { ok: 'OK', low: 'BAJO', out: 'AGOTADO' }
const STOCK_STATUS_CLASS: Record<StockStatus, string> = {
  ok:  'stockBadgeOk',
  low: 'stockBadgeLow',
  out: 'stockBadgeOut',
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

/* ── Product side panel ── */

interface PanelProps {
  product: Product
  todayMoves: InventoryEntry[]
  onClose: () => void
  onRegisterEntry: (p: Product) => void
}

function ProductPanel({ product, todayMoves, onClose, onRegisterEntry }: PanelProps) {
  const isW      = product.sale_mode === 'weight'
  const status   = getStockStatus(product)
  const price    = product.price_per_unit_usd
  const cost     = product.cost_per_unit_usd
  const margen   = price && cost && price > 0
    ? ((price - cost) / price) * 100
    : null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className={styles.panelBackdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.aside
        className={styles.panel}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.8 }}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
      >
        {/* Header */}
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>{product.name}</h2>
            <span className={styles.panelUnit}>{product.base_unit_label}</span>
          </div>
          <button
            className={styles.panelClose}
            onClick={onClose}
            type="button"
            aria-label="Cerrar panel"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.panelBody}>

          {/* Stock status badge */}
          <div className={styles.panelStatusRow}>
            <span className={`${styles.stockBadge} ${styles[STOCK_STATUS_CLASS[status]]}`}>
              {STOCK_STATUS_LABEL[status]}
            </span>
          </div>

          {/* Stock section */}
          <div className={styles.panelSection}>
            <p className={styles.panelSectionTitle}>Stock</p>
            <div className={styles.panelMetaGrid}>
              <div className={styles.panelMetaItem}>
                <span className={styles.panelMetaLabel}>Actual</span>
                <span className={styles.panelMetaValue}>
                  {product.stock.net_qty.toFixed(isW ? 3 : 0)}&nbsp;{product.base_unit_label}
                </span>
              </div>
              <div className={styles.panelMetaItem}>
                <span className={styles.panelMetaLabel}>Mínimo</span>
                <span className={styles.panelMetaValue}>
                  {product.min_stock > 0
                    ? `${product.min_stock.toFixed(isW ? 3 : 0)} ${product.base_unit_label}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Precio / Costo / Margen */}
          <div className={styles.panelSection}>
            <p className={styles.panelSectionTitle}>Precios</p>
            <div className={styles.panelMetaGrid}>
              <div className={styles.panelMetaItem}>
                <span className={styles.panelMetaLabel}>Precio venta</span>
                <span className={styles.panelMetaValue}>
                  {price != null ? `$${price.toFixed(3)}` : '—'}
                </span>
              </div>
              <div className={styles.panelMetaItem}>
                <span className={styles.panelMetaLabel}>Costo</span>
                <span className={styles.panelMetaValue}>
                  {cost != null ? `$${cost.toFixed(3)}` : '—'}
                </span>
              </div>
              {margen !== null && (
                <div className={styles.panelMetaItem}>
                  <span className={styles.panelMetaLabel}>Margen</span>
                  <span className={`${styles.panelMetaValue} ${margen >= 0 ? styles.panelMargenPos : styles.panelMargenNeg}`}>
                    {margen.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Movimientos de hoy */}
          <div className={styles.panelSection}>
            <p className={styles.panelSectionTitle}>Movimientos de hoy</p>
            {todayMoves.length === 0 ? (
              <p className={styles.movEmpty}>Sin movimientos hoy</p>
            ) : (
              <ul className={styles.movList} aria-label="Movimientos de hoy">
                {todayMoves.map(e => {
                  const t = getEntryType(e)
                  const qty = t === 'ajuste'
                    ? `-${e.waste.toFixed(isW ? 3 : 0)}`
                    : `+${e.quantity.toFixed(isW ? 3 : 0)}`
                  return (
                    <li key={e.id} className={styles.movItem}>
                      <span className={`${styles.typeBadgeEntrada} ${t === 'ajuste' ? styles.typeBadgeAjuste : ''}`}>
                        {t === 'entrada' ? 'E' : 'A'}
                      </span>
                      <span className={styles.movQty}>{qty}&nbsp;{product.base_unit_label}</span>
                      <span className={styles.movTime}>{fmtTime(e.entered_at)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            {/* CLI-A: implement GET /api/inventory/product/{id}/movements?date=X for paginated history */}
          </div>

          {/* Actions */}
          <div className={styles.panelActions}>
            <button
              className={styles.panelBtn}
              type="button"
              onClick={() => onRegisterEntry(product)}
            >
              <Plus size={14} aria-hidden="true" />
              Registrar Entrada
            </button>
            <button
              className={styles.panelBtnSecondary}
              type="button"
              disabled
              title="Próximamente"
              aria-label="Ajustar stock — próximamente"
            >
              Ajustar stock
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

/* ── Main content ── */

function InventarioContent() {
  const { toast } = useToast()
  const [products, setProducts]             = useState<Product[]>([])
  const [entries, setEntries]               = useState<InventoryEntry[]>([])
  const [search, setSearch]                 = useState('')
  const [loading, setLoading]               = useState(true)
  const [panelProduct, setPanelProduct]     = useState<Product | null>(null)
  const [entryProduct, setEntryProduct]     = useState<Product | null>(null)
  const [scannerActive, setScannerActive]   = useState(false)

  const { videoContainerRef } = useScanner({
    active: scannerActive,
    onResult: (barcode) => {
      const found = products.find(p => p.barcode === barcode)
      if (found) {
        setScannerActive(false)
        setPanelProduct(found)
      } else {
        toast('Producto no encontrado', 'error')
      }
    },
  })

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

  const todayStr = new Date().toISOString().slice(0, 10)

  /* ── KPI computations ── */
  const kpiEntradoHoy = useMemo(() => {
    const todayEntradas = entries.filter(e =>
      e.entered_at.slice(0, 10) === todayStr && getEntryType(e) === 'entrada'
    )
    return {
      qty: todayEntradas.reduce((s, e) => s + e.quantity, 0),
      usd: todayEntradas.reduce((s, e) =>
        s + (e.cost_per_unit_usd != null ? e.quantity * e.cost_per_unit_usd : 0), 0),
    }
  }, [entries, todayStr])

  const kpiStockTotal   = useMemo(() => products.reduce((s, p) => s + Math.max(0, p.stock.net_qty), 0), [products])
  const kpiBajoMinimo   = useMemo(() => products.filter(p => p.is_low_stock || (p.min_stock > 0 && p.stock.net_qty <= p.min_stock)).length, [products])
  const kpiValorTotal   = useMemo(() =>
    products.reduce((s, p) => {
      if (p.cost_per_unit_usd != null && p.stock.net_qty > 0) return s + p.stock.net_qty * p.cost_per_unit_usd
      return s
    }, 0), [products])

  /* ── Panel today moves ── */
  const panelTodayMoves = useMemo(() => {
    if (!panelProduct) return []
    return entries.filter(e => e.product.id === panelProduct.id && e.entered_at.slice(0, 10) === todayStr)
  }, [entries, panelProduct, todayStr])

  const filtered = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku?.toLowerCase().includes(q) ?? false) ||
      (p.barcode?.toLowerCase().includes(q) ?? false)
    )
  })

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
  const valorFiltrado = useMemo(() =>
    filteredEntries.reduce((s, e) => {
      if (e.cost_per_unit_usd != null) return s + e.quantity * e.cost_per_unit_usd
      return s
    }, 0),
    [filteredEntries]
  )

  function resetFilters() {
    setHistSearch(''); setHistType('all'); setHistFrom(''); setHistTo(''); setHistPage(0)
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
    setEntryProduct(null)
    setPanelProduct(null)
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
        <button
          className={styles.scanBtn}
          onClick={() => setScannerActive(s => !s)}
          type="button"
          aria-label="Escanear código de barras"
        >
          <ScanBarcode size={16} aria-hidden="true" />
          Escanear
        </button>
      </div>

      {scannerActive && (
        <div className={styles.scannerWrap} onClick={() => setScannerActive(false)}>
          <div ref={videoContainerRef} className={styles.scannerVideo} />
          <button
            className={styles.scannerClose}
            onClick={() => setScannerActive(false)}
            type="button"
            aria-label="Cerrar scanner"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonWrap} aria-label="Cargando…">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className={styles.kpiStrip} aria-label="Resumen de inventario">
            <div className={styles.kpiMini}>
              <ArrowDownToLine size={15} className={styles.kpiMiniIcon} aria-hidden="true" />
              <span className={styles.kpiMiniLabel}>Entrado hoy</span>
              <span className={styles.kpiMiniValue}>{kpiEntradoHoy.qty.toFixed(0)} und</span>
              {kpiEntradoHoy.usd > 0 && (
                <span className={styles.kpiMiniSub}>${kpiEntradoHoy.usd.toFixed(2)}</span>
              )}
            </div>
            <div className={styles.kpiMini}>
              <Layers size={15} className={styles.kpiMiniIcon} aria-hidden="true" />
              <span className={styles.kpiMiniLabel}>Stock total</span>
              <span className={styles.kpiMiniValue}>{kpiStockTotal.toFixed(0)} und</span>
            </div>
            <div className={`${styles.kpiMini} ${kpiBajoMinimo > 0 ? styles.kpiMiniWarn : ''}`}>
              <AlertTriangle size={15} className={styles.kpiMiniIcon} aria-hidden="true" />
              <span className={styles.kpiMiniLabel}>Bajo mínimo</span>
              <span className={styles.kpiMiniValue}>{kpiBajoMinimo}</span>
              <span className={styles.kpiMiniSub}>
                {kpiBajoMinimo === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <div className={styles.kpiMini}>
              <DollarSign size={15} className={styles.kpiMiniIcon} aria-hidden="true" />
              <span className={styles.kpiMiniLabel}>Valor inventario</span>
              <span className={styles.kpiMiniValue}>${kpiValorTotal.toFixed(2)}</span>
              <span className={styles.kpiMiniSub}>a costo</span>
            </div>
          </div>

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
                  placeholder="Nombre, SKU o código de barras…"
                  aria-label="Buscar producto por nombre, SKU o código de barras"
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
                      <th className={styles.th}>Estado</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Stock actual</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Costo / und</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const isW    = p.sale_mode === 'weight'
                      const status = getStockStatus(p)
                      return (
                        <tr
                          key={p.id}
                          className={`${styles.tr} ${styles.trClickable}`}
                          onClick={() => setPanelProduct(p)}
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPanelProduct(p) }}
                          aria-label={`Ver detalles de ${p.name}`}
                        >
                          <td className={styles.td}>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productUnit}>{p.base_unit_label}</span>
                          </td>
                          <td className={styles.td}>
                            <span className={`${styles.stockBadge} ${styles[STOCK_STATUS_CLASS[status]]}`}>
                              {STOCK_STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            <span className={status === 'out' ? styles.stockLow : status === 'low' ? styles.stockLow : styles.stockOk}>
                              {p.stock.net_qty.toFixed(isW ? 3 : 0)}
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`}>
                            {p.cost_per_unit_usd != null
                              ? <span className={styles.price}>${p.cost_per_unit_usd.toFixed(3)}</span>
                              : <span className={styles.dash}>—</span>}
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
                    Haz clic en cualquier producto para registrar una entrada
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
                        const isWt     = e.product.base_unit_label !== 'und'
                        const qty      = type === 'ajuste'
                          ? `-${e.waste.toFixed(isWt ? 3 : 0)}`
                          : `+${e.quantity.toFixed(isWt ? 3 : 0)}`
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
                              <span className={styles.userCell}>{e.user?.name ?? '—'}</span>
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
                    <span className={styles.totalValue}>${valorFiltrado.toFixed(2)}</span>
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

      {/* ── Side panel ── */}
      <AnimatePresence>
        {panelProduct && !entryProduct && (
          <ProductPanel
            product={panelProduct}
            todayMoves={panelTodayMoves}
            onClose={() => setPanelProduct(null)}
            onRegisterEntry={p => setEntryProduct(p)}
          />
        )}
      </AnimatePresence>

      {/* ── Entry modal ── */}
      {entryProduct && (
        <EntryModal
          product={entryProduct}
          onClose={() => setEntryProduct(null)}
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
