'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, ShoppingBag, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
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

interface PurchasesResponse { ok: boolean; purchases?: PurchaseListItem[]; error?: string }
interface SuppliersResponse { ok: boolean; suppliers?: Supplier[]; error?: string }
interface PurchaseCreateResponse { ok: boolean; purchase?: { id: number }; error?: string }
interface ProductSearchResponse { ok: boolean; products?: Array<{ id: number; name: string; price_per_unit_usd: number | null; price_per_kg_usd: number | null; cost_per_unit_usd: number | null }> }

const STATUS_LABEL: Record<PurchaseListItem['status'], string> = {
  received:  'Recibida',
  pending:   'Pendiente',
  cancelled: 'Cancelada',
}

const STATUS_CLASS: Record<PurchaseListItem['status'], string> = {
  received:  styles.statusReceived,
  pending:   styles.statusPending,
  cancelled: styles.statusCancelled,
}

function fmtUsd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(n: number) {
  return 'Bs ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface DraftItem {
  key:      string
  product:  ProductOption
  qty:      number
  cost_usd: number
}

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
  const [items, setItems]                     = useState<DraftItem[]>([])
  const [productQuery, setProductQuery]       = useState('')
  const [productResults, setProductResults]   = useState<ProductOption[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

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

  // Sin endpoint de texto libre en /api/purchases — filtro cliente-side sobre lo ya cargado
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return purchases
    return purchases.filter(p => p.supplier.name.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q))
  }, [purchases, search])

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
    setItems([])
    setProductQuery('')
    setProductResults([])
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
          status:      'received',
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

  return (
    <div className={proveedoresStyles.page}>
      <div className={proveedoresStyles.header}>
        <h1 className={proveedoresStyles.title}>Compras</h1>
        <Button leftIcon={<Plus size={16} />} onClick={openModal}>Nueva compra</Button>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Input placeholder="Buscar por proveedor o referencia..." leftIcon={<Search size={16} />} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={styles.select} value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} aria-label="Filtrar por proveedor">
          <option value="all">Todos los proveedores</option>
          {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>

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
                  <td><span className={`${styles.statusBadge} ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          <select className={styles.select} value={draftSupplierId} onChange={e => setDraftSupplierId(e.target.value)}>
            <option value="">Selecciona un proveedor</option>
            {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>

        <Input label="Referencia / Factura" value={reference} onChange={e => setReference(e.target.value)} placeholder="FAC-001" />

        <div className={proveedoresStyles.formField}>
          <label className={proveedoresStyles.fieldLabel}>Notas</label>
          <textarea className={proveedoresStyles.textarea} value={notes} onChange={e => setNotes(e.target.value)} />
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
