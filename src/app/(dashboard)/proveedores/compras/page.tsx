'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, ShoppingBag, Truck, X, DollarSign, Clock, Ban, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { useToast } from '@/components/ui/Toast'
import type { Supplier, ProductOption } from '../types'
import proveedoresStyles from '../proveedores.module.css'
import styles from './compras.module.css'

// Forma real que devuelve GET /api/purchases (incluye supplier {id,name} y _count.items,
// NO trae los items completos — eso solo lo da GET /api/purchases/[id])
interface PurchaseListItem {
  id:          number
  supplier_id: number
  supplier:    { id: number; name: string }
  reference:   string | null
  notes:       string | null
  status:      'received' | 'pending' | 'cancelled'
  total_usd:   number
  created_at:  string
  _count:      { items: number }
}

interface PurchaseDetailItem {
  id:      number
  qty:     number
  cost_usd: number
  product: { id: number; name: string; price_per_unit_usd: number | null }
}

interface PurchaseDetail {
  id:          number
  reference:   string | null
  notes:       string | null
  status:      PurchaseListItem['status']
  total_usd:   number
  created_at:  string
  supplier:    { id: number; name: string; rif: string | null; phone: string | null; email: string | null }
  items:       PurchaseDetailItem[]
}

interface PurchasesResponse { ok: boolean; purchases?: PurchaseListItem[]; error?: string }
interface SuppliersResponse { ok: boolean; suppliers?: Supplier[]; error?: string }
interface SupplierResponse  { ok: boolean; supplier?: Supplier; error?: string }
interface PurchaseCreateResponse { ok: boolean; purchase?: { id: number }; error?: string }
interface PurchaseDetailResponse { ok: boolean; purchase?: PurchaseDetail; error?: string }
interface PurchasePatchResponse { ok: boolean; purchase?: { id: number; status: string }; error?: string }
interface ProductSearchResponse { ok: boolean; products?: Array<{ id: number; name: string; price_per_unit_usd: number | null; price_per_kg_usd: number | null; cost_per_unit_usd: number | null }> }

// Labels y variantes de Badge — "reusa el patrón de badges existente en el proyecto"
// en vez de hardcodear hex sin token (#FEF3C7/#DCFCE7 no existen en tokens.css;
// Badge variant="warning"/"success" ya usa --color-warning-text/#D97706 exacto).
const STATUS_LABEL: Record<PurchaseListItem['status'], string> = {
  received:  'Confirmada',
  pending:   'Pendiente',
  cancelled: 'Anulada',
}

const STATUS_VARIANT: Record<PurchaseListItem['status'], 'success' | 'warning' | 'neutral'> = {
  received:  'success',
  pending:   'warning',
  cancelled: 'neutral',
}

function fmtUsd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(n: number) {
  return 'Bs ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

interface DraftItem {
  key:      string
  product:  ProductOption
  qty:      number
  cost_usd: number
}

const EMPTY_QUICK_SUPPLIER = { name: '', rif: '', phone: '', email: '', address: '', notes: '' }

function ComprasContent() {
  const searchParams = useSearchParams()
  const { toast }    = useToast()

  const [purchases, setPurchases] = useState<PurchaseListItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>(searchParams.get('supplier') ?? 'all')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bcvRate, setBcvRate]     = useState<number | null>(null)

  const [modalOpen, setModalOpen]             = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [draftSupplierId, setDraftSupplierId] = useState<string>('')
  const [reference, setReference]             = useState('')
  const [notes, setNotes]                     = useState('')
  const [creationStatus, setCreationStatus]   = useState<'received' | 'pending'>('received')
  const [items, setItems]                     = useState<DraftItem[]>([])
  const [productQuery, setProductQuery]       = useState('')
  const [productResults, setProductResults]   = useState<ProductOption[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // ── Proveedor inline (sin salir del modal de compra) ──
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [quickForm, setQuickForm]                 = useState(EMPTY_QUICK_SUPPLIER)
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false)

  // ── Acciones por fila (confirmar/anular) ──
  const [actioningId, setActioningId] = useState<number | null>(null)

  // ── Modal "Ver detalle" ──
  const [detailId, setDetailId]         = useState<number | null>(null)
  const [detail, setDetail]             = useState<PurchaseDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadPurchases = useCallback(async (supplierId: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = supplierId !== 'all' ? `/api/purchases?supplier_id=${supplierId}` : '/api/purchases'
      const res  = await fetch(url)
      const json = await res.json() as PurchasesResponse
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'No se pudo cargar la lista de compras')
        return
      }
      setPurchases(json.purchases ?? [])
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPurchases(supplierFilter) }, [supplierFilter, loadPurchases])

  useEffect(() => {
    fetch('/api/suppliers')
      .then(r => r.json())
      .then((j: SuppliersResponse) => { if (j.ok) setSuppliers(j.suppliers ?? []) })
      .catch(() => {})

    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then(j => { if (j.ok && j.rate) setBcvRate(Number(j.rate)) })
      .catch(() => {})
  }, [])

  // ── Detalle de compra (solo lectura) ──
  useEffect(() => {
    if (detailId === null) { setDetail(null); return }
    setLoadingDetail(true)
    fetch(`/api/purchases/${detailId}`)
      .then(r => r.json())
      .then((j: PurchaseDetailResponse) => {
        if (j.ok && j.purchase) setDetail(j.purchase)
        else toast(j.error ?? 'No se pudo cargar el detalle', 'error')
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoadingDetail(false))
  }, [detailId, toast])

  const activeSupplier = supplierFilter !== 'all' ? suppliers.find(s => String(s.id) === supplierFilter) : undefined

  function clearSupplierFilter() {
    setSupplierFilter('all')
  }

  // Sin endpoint de texto libre en /api/purchases — filtro cliente-side sobre lo ya cargado
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return purchases
    return purchases.filter(p => p.supplier.name.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q))
  }, [purchases, search])

  // ── KPIs — calculados sobre `purchases` (respeta filtro de proveedor, no el
  // buscador de texto libre), mismo criterio que GastosSection en Finanzas ──
  const kpiTotalMonth = useMemo(() =>
    purchases
      .filter(p => (p.status === 'received' || p.status === 'pending') && isThisMonth(p.created_at))
      .reduce((s, p) => s + p.total_usd, 0),
    [purchases]
  )
  const kpiPendingCount = useMemo(() => purchases.filter(p => p.status === 'pending').length, [purchases])
  const kpiCancelledMonthCount = useMemo(() =>
    purchases.filter(p => p.status === 'cancelled' && isThisMonth(p.created_at)).length,
    [purchases]
  )

  // Debounce de búsqueda de productos contra /api/products/search (param real: q, no "search")
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    setSearchingProducts(true)
    const timer = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(productQuery.trim())}`)
        .then(r => r.json())
        .then((j: ProductSearchResponse) => {
          if (!j.ok) return
          const options = (j.products ?? [])
            .filter(p => !items.some(i => i.product.id === p.id))
            .map(p => ({
              id:                 p.id,
              name:               p.name,
              price_per_unit_usd: p.cost_per_unit_usd ?? p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0,
            }))
          setProductResults(options)
        })
        .finally(() => setSearchingProducts(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [productQuery, items])

  function openModal() {
    setDraftSupplierId('')
    setReference('')
    setNotes('')
    setCreationStatus('received')
    setItems([])
    setProductQuery('')
    setProductResults([])
    setShowQuickSupplier(false)
    setQuickForm(EMPTY_QUICK_SUPPLIER)
    setModalOpen(true)
  }

  function addProduct(product: ProductOption) {
    setItems(prev => [...prev, { key: `${product.id}-${Date.now()}`, product, qty: 1, cost_usd: product.price_per_unit_usd }])
    setProductQuery('')
    setProductResults([])
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateItem(key: string, patch: Partial<Pick<DraftItem, 'qty' | 'cost_usd'>>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i))
  }

  const totalUsd = items.reduce((sum, i) => sum + i.qty * i.cost_usd, 0)
  const totalBs  = bcvRate ? totalUsd * bcvRate : 0

  const isValid = draftSupplierId !== '' && items.length > 0

  async function handleRegister() {
    if (!isValid) return
    setSaving(true)

    try {
      const res = await fetch('/api/purchases', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(draftSupplierId),
          reference:   reference || undefined,
          notes:       notes || undefined,
          status:      creationStatus,
          items:       items.map(i => ({ product_id: i.product.id, qty: i.qty, cost_usd: i.cost_usd })),
        }),
      })
      const json = await res.json() as PurchaseCreateResponse
      if (!res.ok || !json.ok) {
        toast(json.error ?? 'No se pudo registrar la compra', 'error')
        return
      }

      toast(`Compra registrada: ${items.length} producto${items.length !== 1 ? 's' : ''} · ${fmtUsd(totalUsd)} · stock actualizado`, 'success')
      setModalOpen(false)
      void loadPurchases(supplierFilter)
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Proveedor inline ──
  async function handleSaveQuickSupplier() {
    if (!quickForm.name.trim()) return
    setSavingQuickSupplier(true)
    try {
      const res = await fetch('/api/suppliers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    quickForm.name.trim(),
          rif:     quickForm.rif || undefined,
          phone:   quickForm.phone || undefined,
          email:   quickForm.email || undefined,
          address: quickForm.address || undefined,
          notes:   quickForm.notes || undefined,
        }),
      })
      const json = await res.json() as SupplierResponse
      if (!res.ok || !json.ok || !json.supplier) {
        toast(json.error ?? 'No se pudo crear el proveedor', 'error')
        return
      }
      const created = json.supplier
      setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setDraftSupplierId(String(created.id))
      setShowQuickSupplier(false)
      setQuickForm(EMPTY_QUICK_SUPPLIER)
      toast('Proveedor creado', 'success')
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSavingQuickSupplier(false)
    }
  }

  // ── Confirmar compra (pending → received) ──
  async function handleConfirmPurchase(id: number) {
    setActioningId(id)
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'received' }),
      })
      const json = await res.json() as PurchasePatchResponse
      if (!res.ok || !json.ok) {
        toast(json.error ?? 'No se pudo confirmar la compra', 'error')
        return
      }
      toast('Compra confirmada', 'success')
      void loadPurchases(supplierFilter)
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setActioningId(null)
    }
  }

  // ── Anular compra ──
  async function handleCancelPurchase(id: number) {
    if (!confirm('¿Anular esta compra? Se revertirá el stock ingresado y se cerrará la cuenta por pagar asociada.')) return
    setActioningId(id)
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json() as PurchasePatchResponse
      if (!res.ok || !json.ok) {
        toast(json.error ?? 'No se pudo anular la compra', 'error')
        return
      }
      toast('Compra anulada', 'success')
      void loadPurchases(supplierFilter)
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className={proveedoresStyles.page}>
      <div className={proveedoresStyles.header}>
        <h1 className={proveedoresStyles.title}>Compras</h1>
        <Button leftIcon={<Plus size={16} />} onClick={openModal}>Nueva compra</Button>
      </div>

      {/* ── KPIs ── */}
      {!loading && !error && (
        <div className={styles.kpiGrid}>
          <KpiCard
            label="Total compras del mes"
            value={fmtUsd(kpiTotalMonth)}
            icon={DollarSign}
            iconVariant="brand"
          />
          <KpiCard
            label="Pendientes de confirmar"
            value={String(kpiPendingCount)}
            icon={Clock}
            iconVariant="warning"
          />
          <KpiCard
            label="Canceladas este mes"
            value={String(kpiCancelledMonthCount)}
            icon={Ban}
            iconVariant="info"
          />
        </div>
      )}

      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Input placeholder="Buscar por proveedor o referencia..." leftIcon={<Search size={16} />} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={styles.select} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} aria-label="Filtrar por proveedor">
          <option value="all">Todos los proveedores</option>
          {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>

      {supplierFilter !== 'all' && (
        <div className={styles.activeFilterBanner}>
          <Truck size={14} aria-hidden="true" />
          <span>Mostrando compras de: <strong>{activeSupplier?.name ?? `Proveedor #${supplierFilter}`}</strong></span>
          <button type="button" className={styles.clearFilterBtn} onClick={clearSupplierFilter}>
            <X size={13} aria-hidden="true" /> limpiar
          </button>
        </div>
      )}

      {error ? (
        <div className={proveedoresStyles.tableWrap}>
          <div className={proveedoresStyles.emptyState}>
            <p className={proveedoresStyles.emptyTitle}>No se pudo cargar</p>
            <p className={proveedoresStyles.emptyDesc}>{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className={proveedoresStyles.tableWrap}>
          <div className={proveedoresStyles.emptyState}>
            <p className={proveedoresStyles.emptyDesc}>Cargando compras…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={proveedoresStyles.tableWrap}>
          <div className={proveedoresStyles.emptyState}>
            <ShoppingBag size={32} className={proveedoresStyles.emptyIcon} aria-hidden="true" />
            <p className={proveedoresStyles.emptyTitle}>
              {purchases.length === 0 ? 'Sin compras registradas' : 'Sin resultados'}
            </p>
            <p className={proveedoresStyles.emptyDesc}>
              {purchases.length === 0 ? 'Registra tu primera compra a un proveedor.' : 'Prueba con otro filtro.'}
            </p>
          </div>
        </div>
      ) : (
        <div className={proveedoresStyles.tableWrap}>
          <table className={proveedoresStyles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Ref</th>
                <th>Items</th>
                <th>Total</th>
                <th>Estado</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</td>
                  <td className={proveedoresStyles.tdName}>{p.supplier.name}</td>
                  <td>{p.reference ?? '—'}</td>
                  <td>{p._count.items}</td>
                  <td>{fmtUsd(p.total_usd)}</td>
                  <td><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                  <td>
                    {p.status === 'pending' && (
                      <div className={styles.rowActionsCell}>
                        <button
                          type="button"
                          className={proveedoresStyles.actionLink}
                          onClick={() => void handleConfirmPurchase(p.id)}
                          disabled={actioningId === p.id}
                        >
                          {actioningId === p.id ? 'Confirmando…' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          className={`${proveedoresStyles.actionLink} ${proveedoresStyles.actionDanger}`}
                          onClick={() => void handleCancelPurchase(p.id)}
                          disabled={actioningId === p.id}
                        >
                          {actioningId === p.id ? 'Anulando…' : 'Anular'}
                        </button>
                      </div>
                    )}
                    {p.status === 'received' && (
                      <button type="button" className={proveedoresStyles.actionLink} onClick={() => setDetailId(p.id)}>
                        Ver detalle
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Nueva Compra ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva Compra"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button disabled={!isValid} loading={saving} onClick={() => void handleRegister()}>Registrar Compra</Button>
          </>
        }
      >
        <div className={proveedoresStyles.formField}>
          <label className={proveedoresStyles.fieldLabel}>Proveedor</label>
          <div className={styles.supplierRow}>
            <select className={styles.select} value={draftSupplierId} onChange={e => setDraftSupplierId(e.target.value)}>
              <option value="">Selecciona un proveedor</option>
              {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <button
              type="button"
              className={styles.addSupplierBtn}
              onClick={() => setShowQuickSupplier(v => !v)}
              aria-label="Crear nuevo proveedor"
              aria-expanded={showQuickSupplier}
              title="Crear nuevo proveedor"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>

          {showQuickSupplier && (
            <div className={styles.quickSupplierPanel}>
              <p className={styles.quickSupplierTitle}>Nuevo proveedor</p>
              <Input
                placeholder="Nombre *"
                value={quickForm.name}
                onChange={e => setQuickForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <div className={styles.quickSupplierRow2}>
                <Input placeholder="RIF" value={quickForm.rif} onChange={e => setQuickForm(f => ({ ...f, rif: e.target.value }))} />
                <Input placeholder="Teléfono" value={quickForm.phone} onChange={e => setQuickForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <Input placeholder="Email" type="email" value={quickForm.email} onChange={e => setQuickForm(f => ({ ...f, email: e.target.value }))} />
              <div className={styles.quickSupplierActions}>
                <Button variant="secondary" size="sm" onClick={() => { setShowQuickSupplier(false); setQuickForm(EMPTY_QUICK_SUPPLIER) }}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={!quickForm.name.trim()} loading={savingQuickSupplier} onClick={() => void handleSaveQuickSupplier()}>
                  Guardar proveedor
                </Button>
              </div>
            </div>
          )}
        </div>

        <Input label="Referencia / Factura" value={reference} onChange={e => setReference(e.target.value)} placeholder="FAC-001" />

        <div className={proveedoresStyles.formField}>
          <label className={proveedoresStyles.fieldLabel}>Notas</label>
          <textarea className={proveedoresStyles.textarea} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className={proveedoresStyles.formField}>
          <label className={proveedoresStyles.fieldLabel}>Estado inicial</label>
          <div className={styles.radioRow} role="radiogroup" aria-label="Estado inicial de la compra">
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="creationStatus"
                checked={creationStatus === 'received'}
                onChange={() => setCreationStatus('received')}
              />
              Confirmada
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="creationStatus"
                checked={creationStatus === 'pending'}
                onChange={() => setCreationStatus('pending')}
              />
              Pendiente
            </label>
          </div>
        </div>

        <div className={styles.itemsBox}>
          <div className={styles.itemSearchRow}>
            <Input
              placeholder="Buscar producto..."
              leftIcon={<Search size={16} />}
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
            />
            {(productResults.length > 0 || searchingProducts) && (
              <div className={styles.productSuggestions}>
                {searchingProducts ? (
                  <div className={styles.emptyItems}>Buscando…</div>
                ) : (
                  productResults.map(p => (
                    <button key={p.id} type="button" className={styles.productSuggestion} onClick={() => addProduct(p)}>
                      <span>{p.name}</span>
                      <span>{fmtUsd(p.price_per_unit_usd)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className={styles.emptyItems}>Sin productos agregados aún.</p>
          ) : (
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Qty</th>
                  <th>Costo USD</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.key}>
                    <td>{i.product.name}</td>
                    <td>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        className={styles.itemQtyInput}
                        value={i.qty}
                        onChange={e => updateItem(i.key, { qty: Math.max(0, Number(e.target.value)) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={styles.itemCostInput}
                        value={i.cost_usd}
                        onChange={e => updateItem(i.key, { cost_usd: Math.max(0, Number(e.target.value)) })}
                      />
                    </td>
                    <td>{fmtUsd(i.qty * i.cost_usd)}</td>
                    <td>
                      <button type="button" className={styles.itemRemoveBtn} onClick={() => removeItem(i.key)} aria-label={`Quitar ${i.product.name}`}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.totalsRow}>
            <span className={styles.totalLabel}>Total de la compra</span>
            <span className={styles.totalValue}>{fmtUsd(totalUsd)}</span>
          </div>
          <div className={styles.totalsRow}>
            <span className={styles.totalLabel}>Equivalente Bs</span>
            <span className={styles.totalValueBs}>{bcvRate ? fmtBs(totalBs) : '—'}</span>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Ver detalle (solo lectura) ── */}
      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Detalle de Compra"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setDetailId(null)}>Cerrar</Button>}
      >
        {loadingDetail ? (
          <div className={styles.detailLoading}>
            <Loader2 size={20} className={styles.spinIcon} aria-hidden="true" />
            Cargando detalle…
          </div>
        ) : !detail ? (
          <p className={styles.emptyItems}>No se pudo cargar el detalle.</p>
        ) : (
          <>
            <div className={styles.detailGrid}>
              <div>
                <span className={styles.detailLabel}>Proveedor</span>
                <span className={styles.detailValue}>{detail.supplier.name}</span>
              </div>
              <div>
                <span className={styles.detailLabel}>Referencia</span>
                <span className={styles.detailValue}>{detail.reference ?? '—'}</span>
              </div>
              <div>
                <span className={styles.detailLabel}>Fecha</span>
                <span className={styles.detailValue}>
                  {new Date(detail.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div>
                <span className={styles.detailLabel}>Estado</span>
                <span className={styles.detailValue}><Badge variant={STATUS_VARIANT[detail.status]}>{STATUS_LABEL[detail.status]}</Badge></span>
              </div>
            </div>

            {detail.notes && (
              <div className={styles.detailNotes}>
                <span className={styles.detailLabel}>Notas</span>
                <p className={styles.detailValue}>{detail.notes}</p>
              </div>
            )}

            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Qty</th>
                  <th>Costo USD</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map(i => (
                  <tr key={i.id}>
                    <td>{i.product.name}</td>
                    <td>{i.qty}</td>
                    <td>{fmtUsd(i.cost_usd)}</td>
                    <td>{fmtUsd(i.qty * i.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.totalsRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{fmtUsd(detail.total_usd)}</span>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default function ComprasPage() {
  return (
    <Suspense fallback={null}>
      <ComprasContent />
    </Suspense>
  )
}
