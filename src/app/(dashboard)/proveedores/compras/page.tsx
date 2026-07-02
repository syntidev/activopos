'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, ShoppingBag, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { MOCK_PRODUCTS, MOCK_SUPPLIERS } from '../types'
import type { Purchase, PurchaseItem, ProductOption } from '../types'
import proveedoresStyles from '../proveedores.module.css'
import styles from './compras.module.css'

// CLI-A: sin /api/purchases todavía — arranca vacío, "Registrar Compra" solo
// actualiza este estado local. El backend real es quien sube el stock.
const INITIAL_PURCHASES: Purchase[] = []

const STATUS_LABEL: Record<Purchase['status'], string> = {
  received:  'Recibida',
  pending:   'Pendiente',
  cancelled: 'Cancelada',
}

const STATUS_CLASS: Record<Purchase['status'], string> = {
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
  key:       string
  product:   ProductOption
  qty:       number
  cost_usd:  number
}

function ComprasContent() {
  const searchParams   = useSearchParams()
  const { toast }      = useToast()

  const [purchases, setPurchases] = useState<Purchase[]>(INITIAL_PURCHASES)
  const [search, setSearch]       = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>(searchParams.get('supplier') ?? 'all')
  const [bcvRate, setBcvRate]     = useState<number | null>(null)

  const [modalOpen, setModalOpen]         = useState(false)
  const [draftSupplierId, setDraftSupplierId] = useState<string>('')
  const [reference, setReference]         = useState('')
  const [notes, setNotes]                 = useState('')
  const [items, setItems]                 = useState<DraftItem[]>([])
  const [productQuery, setProductQuery]   = useState('')

  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.json())
      .then(j => { if (j.ok && j.rate) setBcvRate(Number(j.rate)) })
      .catch(() => {})
  }, [])

  const filtered = purchases.filter(p => {
    const matchesSupplier = supplierFilter === 'all' || String(p.supplier_id) === supplierFilter
    const q = search.toLowerCase()
    const matchesSearch = !q || p.supplier.name.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q)
    return matchesSupplier && matchesSearch
  })

  const productSuggestions = useMemo(() => {
    if (!productQuery.trim()) return []
    const q = productQuery.toLowerCase()
    return MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(q) && !items.some(i => i.product.id === p.id)).slice(0, 6)
  }, [productQuery, items])

  function openModal() {
    setDraftSupplierId('')
    setReference('')
    setNotes('')
    setItems([])
    setProductQuery('')
    setModalOpen(true)
  }

  function addProduct(product: ProductOption) {
    setItems(prev => [...prev, { key: `${product.id}-${Date.now()}`, product, qty: 1, cost_usd: product.price_per_unit_usd }])
    setProductQuery('')
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

  function handleRegister() {
    if (!isValid) return
    const supplier = MOCK_SUPPLIERS.find(s => String(s.id) === draftSupplierId)
    if (!supplier) return

    const purchaseItems: PurchaseItem[] = items.map((i, idx) => ({
      id:         Date.now() + idx,
      product_id: i.product.id,
      product:    i.product,
      qty:        i.qty,
      cost_usd:   i.cost_usd,
    }))

    const newPurchase: Purchase = {
      id:          Date.now(),
      supplier_id: supplier.id,
      supplier,
      reference:   reference || undefined,
      notes:       notes || undefined,
      status:      'received',
      total_usd:   totalUsd,
      created_at:  new Date().toISOString(),
      items:       purchaseItems,
    }

    setPurchases(prev => [newPurchase, ...prev])
    setModalOpen(false)
    toast(`Compra registrada: ${purchaseItems.length} producto${purchaseItems.length !== 1 ? 's' : ''} · ${fmtUsd(totalUsd)}`, 'success')
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
          {MOCK_SUPPLIERS.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
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
            <Button disabled={!isValid} onClick={handleRegister}>Registrar Compra</Button>
          </>
        }
      >
        <div className={proveedoresStyles.formField}>
          <label className={proveedoresStyles.fieldLabel}>Proveedor</label>
          <select className={styles.select} value={draftSupplierId} onChange={e => setDraftSupplierId(e.target.value)}>
            <option value="">Selecciona un proveedor</option>
            {MOCK_SUPPLIERS.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
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
            {productSuggestions.length > 0 && (
              <div className={styles.productSuggestions}>
                {productSuggestions.map(p => (
                  <button key={p.id} type="button" className={styles.productSuggestion} onClick={() => addProduct(p)}>
                    <span>{p.name}</span>
                    <span>{fmtUsd(p.price_per_unit_usd)}</span>
                  </button>
                ))}
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
