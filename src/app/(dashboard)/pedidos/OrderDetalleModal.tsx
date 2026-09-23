'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { generarCorteConsumoPDF } from '@/components/pos/CorteConsumoPDF'
import styles from './NuevoPedidoModal.module.css'

/* ── Types ── */

interface ProductResult {
  id: number
  name: string
  sale_mode: 'unit' | 'weight'
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
}

interface EditableItem {
  product_id: number
  product_name: string
  variant_label?: string | null
  quantity: number
  price_per_unit_usd: number
}

export interface OrderDetail {
  id: number
  order_number: string
  status: string
  client_name: string | null
  total_usd: number | string
  total_bs: number | string
  items: {
    id: number
    product_id: number
    product_name: string
    variant_label: string | null
    quantity: number | string
    price_per_unit_usd: number | string
    subtotal_usd: number | string
  }[]
}

interface Props {
  open: boolean
  orderId: number
  onClose: () => void
  onUpdated: (order: OrderDetail) => void
}

const EDITABLE_STATUSES = ['received', 'preparing', 'ready']

const fmtUsd = (n: number) => `$${n.toFixed(2)}`

/* ── Component ── */

export function OrderDetalleModal({ open, orderId, onClose, onUpdated }: Props) {
  const { toast } = useToast()

  const [order, setOrder]     = useState<OrderDetail | null>(null)
  const [items, setItems]     = useState<EditableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [businessName, setBusinessName] = useState('')

  const [productSearch, setProductSearch]   = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const productTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editable = order !== null && EDITABLE_STATUSES.includes(order.status)

  /* ── Load order on open ── */

  useEffect(() => {
    if (!open || !orderId) return
    setLoading(true)
    setError('')
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; order?: OrderDetail; error?: string }) => {
        if (!data.ok || !data.order) {
          setError(data.error ?? 'No se pudo cargar el pedido')
          return
        }
        setOrder(data.order)
        setItems(
          data.order.items.map((i) => ({
            product_id:         i.product_id,
            product_name:       i.product_name,
            variant_label:      i.variant_label,
            quantity:           Number(i.quantity),
            price_per_unit_usd: Number(i.price_per_unit_usd),
          }))
        )
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))

    fetch('/api/config/business')
      .then((r) => r.json())
      .then((j: { business?: { name?: string } }) => {
        if (j.business?.name) setBusinessName(j.business.name)
      })
      .catch(() => {})
  }, [open, orderId])

  useEffect(() => {
    if (!open) {
      setOrder(null)
      setItems([])
      setError('')
      setProductSearch('')
      setProductResults([])
    }
  }, [open])

  /* ── Product search (300ms debounce) ── */

  const fetchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProductResults([]); return }
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const data: { products?: ProductResult[] } = await res.json()
        setProductResults(data.products ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleProductInput = (val: string) => {
    setProductSearch(val)
    if (productTimer.current) clearTimeout(productTimer.current)
    productTimer.current = setTimeout(() => fetchProducts(val), 300)
  }

  const addProduct = (p: ProductResult) => {
    const price = p.sale_mode === 'weight' ? (p.price_per_kg_usd ?? 0) : (p.price_per_unit_usd ?? 0)
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.id)
      if (idx >= 0) {
        return prev.map((item, i) => (i === idx ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, price_per_unit_usd: price }]
    })
    setProductSearch('')
    setProductResults([])
  }

  const changeQty = (idx: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    )
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.price_per_unit_usd, 0)

  /* ── Guardar cambios ── */

  const handleSave = async () => {
    if (items.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id:    i.product_id,
            product_name:  i.product_name,
            variant_label: i.variant_label ?? undefined,
            quantity:      i.quantity,
          })),
        }),
      })
      const data: { ok: boolean; order?: OrderDetail; error?: string } = await res.json()
      if (!res.ok || !data.ok || !data.order) {
        setError(data.error ?? 'Error al guardar los cambios')
        return
      }
      setOrder(data.order)
      onUpdated(data.order)
      toast('Pedido actualizado', 'success')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Corte de cuenta (imprimir, no cambia estado) ── */

  const handleCorte = () => {
    if (!order) return
    generarCorteConsumoPDF({
      docLabel:     `Pedido ${order.order_number}`,
      clientName:   order.client_name,
      items:        items.map((i) => ({
        product_name:  i.product_name,
        variant_label: i.variant_label,
        quantity:      i.quantity,
        subtotal_usd:  Number((i.quantity * i.price_per_unit_usd).toFixed(2)),
      })),
      totalUsd:     total,
      totalBs:      total * (Number(order.total_usd) > 0 ? Number(order.total_bs) / Number(order.total_usd) : 0),
      businessName: businessName || 'ActivoPOS',
    })
  }

  const footer = (
    <>
      <Button variant="ghost" size="md" onClick={onClose}>
        Cerrar
      </Button>
      <Button
        variant="secondary"
        size="md"
        leftIcon={<Printer size={14} aria-hidden="true" />}
        onClick={handleCorte}
        disabled={!order || items.length === 0}
      >
        Corte de cuenta
      </Button>
      {editable && (
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={items.length === 0 || saving}
          loading={saving}
        >
          Guardar cambios
        </Button>
      )}
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? `Pedido ${order.order_number}` : 'Pedido'}
      size="md"
      footer={footer}
    >
      <div className={styles.form}>
        {loading && <p className={styles.cartEmpty}>Cargando...</p>}

        {!loading && order && (
          <>
            {!editable && (
              <p className={styles.error} role="status">
                Este pedido ya no admite edición de ítems (estado: {order.status}).
              </p>
            )}

            {editable && (
              <div className={styles.field}>
                <span className={styles.label}>Agregar producto</span>
                <div className={styles.inputWrap}>
                  <Search size={14} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    type="search"
                    className={styles.input}
                    placeholder="Buscar producto..."
                    value={productSearch}
                    onChange={(e) => handleProductInput(e.target.value)}
                    autoComplete="off"
                    aria-label="Buscar producto"
                  />
                </div>
                {productResults.length > 0 && (
                  <ul className={styles.results} role="listbox" aria-label="Productos encontrados">
                    {productResults.map((p) => {
                      const price = p.sale_mode === 'weight' ? p.price_per_kg_usd : p.price_per_unit_usd
                      return (
                        <li key={p.id} role="option" aria-selected={false}>
                          <button type="button" className={styles.resultBtn} onClick={() => addProduct(p)}>
                            <span className={styles.resultName}>{p.name}</span>
                            <span className={styles.resultPrice}>
                              {price != null ? `$${price.toFixed(2)}` : '—'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className={styles.field}>
              <span className={styles.label}>Ítems del pedido</span>
              {items.length > 0 ? (
                <ul className={styles.cart} aria-label="Ítems del pedido">
                  {items.map((item, idx) => (
                    <li key={`${item.product_id}-${idx}`} className={styles.cartRow}>
                      <span className={styles.cartName}>{item.product_name}</span>
                      <div className={styles.cartControls}>
                        {editable ? (
                          <>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              onClick={() => changeQty(idx, -1)}
                              aria-label={`Disminuir cantidad de ${item.product_name}`}
                            >
                              <Minus size={11} aria-hidden="true" />
                            </button>
                            <span className={styles.qtyVal}>{item.quantity}</span>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              onClick={() => changeQty(idx, 1)}
                              aria-label={`Aumentar cantidad de ${item.product_name}`}
                            >
                              <Plus size={11} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <span className={styles.qtyVal}>{item.quantity}</span>
                        )}
                        <span className={styles.cartSubtotal}>
                          {fmtUsd(item.quantity * item.price_per_unit_usd)}
                        </span>
                        {editable && (
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => removeItem(idx)}
                            aria-label={`Eliminar ${item.product_name} del pedido`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.cartEmpty}>Sin ítems.</p>
              )}
            </div>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{fmtUsd(total)}</span>
            </div>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
