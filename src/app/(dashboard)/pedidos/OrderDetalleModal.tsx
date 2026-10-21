'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { generarCorteConsumoPDF } from '@/components/pos/CorteConsumoPDF'
import { PriceModeSwitch } from '@/components/pos/PriceModeSwitch'
import type { PriceMode, PriceSource } from '@/lib/pos'
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
  price_source?: PriceSource | null
}

/** Línea del `ticket` que devuelve PATCH /api/orders/{id}/price-mode. */
interface PricedLine {
  product_id: number
  variant_id: number | null
  price_per_unit_usd: number
  price_source: PriceSource
}

export interface OrderDetail {
  id: number
  order_number: string
  status: string
  client_name: string | null
  total_usd: number | string
  total_bs: number | string
  rate_used?: number | string
  price_mode?: PriceMode
  items: {
    id: number
    price_source?: PriceSource | null
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
const CLOSED_STATUSES = ['delivered', 'cancelled']

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
  const [modeBusy, setModeBusy]   = useState(false)
  const [modeError, setModeError] = useState('')

  const [productSearch, setProductSearch]   = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const productTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editable = order !== null && EDITABLE_STATUSES.includes(order.status)
  // El servidor rechaza (409) el cambio en pedidos cobrados/entregados/cancelados: ahí el modo se muestra en solo lectura.
  const modeEditable = order !== null && !CLOSED_STATUSES.includes(order.status)

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
            price_source:       i.price_source,
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
  const rate  = order ? Number(order.rate_used ?? 0) || (Number(order.total_usd) > 0 ? Number(order.total_bs) / Number(order.total_usd) : 0) : 0
  const priceMode: PriceMode = order?.price_mode === 'divisa' ? 'divisa' : 'bcv'
  // El servidor reprecia lo guardado: con cambios de ítems sin guardar el modo no se puede cambiar.
  const dirty = order !== null && (items.length !== order.items.length
    || items.some((it, i) => it.product_id !== order.items[i].product_id || it.quantity !== Number(order.items[i].quantity)))

  /* ── Modo de precio (BCV / Divisa): el servidor reprecia el pedido y devuelve las líneas ── */

  const handlePriceMode = async (mode: PriceMode) => {
    if (!order || mode === priceMode || modeBusy) return
    if (dirty) { setModeError('Guarda los cambios de ítems antes de cambiar el modo de precio.'); return }
    setModeBusy(true)
    setModeError('')
    try {
      const res  = await fetch(`/api/orders/${orderId}/price-mode`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ price_mode: mode }),
      })
      const data = await res.json().catch(() => null) as { ticket?: { items: PricedLine[]; total_usd: number; total_bs: number } ; error?: string } | null
      if (!res.ok || !data?.ticket) { setModeError(data?.error ?? 'No se pudo cambiar el modo de precio.'); return }
      const lines = data.ticket.items
      setItems((prev) => prev.map((it, i) => {
        const hit = lines.length === prev.length ? lines[i] : lines.find((l) => l.product_id === it.product_id)
        return hit ? { ...it, price_per_unit_usd: Number(hit.price_per_unit_usd), price_source: hit.price_source } : it
      }))
      const next: OrderDetail = { ...order, price_mode: mode, total_usd: data.ticket.total_usd, total_bs: data.ticket.total_bs }
      setOrder(next)
      onUpdated(next)
    } catch {
      setModeError('Error de conexión. Intenta de nuevo.')
    } finally {
      setModeBusy(false)
    }
  }

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
                        {item.price_source === 'manual' && <span className={styles.lineTag}>Manual</span>}
                        {item.price_source === 'fallback_bcv' && (
                          <span className={styles.lineTag} title="Este producto no tiene precio Divisa: se cobra a precio BCV">Sin precio Divisa</span>
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

            <PriceModeSwitch
              mode={priceMode}
              onChange={modeEditable ? handlePriceMode : undefined}
              readOnly={!modeEditable}
              busy={modeBusy}
              error={modeError}
              fallbackLines={items.filter((i) => i.price_source === 'fallback_bcv').length}
            />

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>
                {fmtUsd(total)}
                {rate > 0 && <span className={styles.totalBs}>Bs. {(total * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              </span>
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
