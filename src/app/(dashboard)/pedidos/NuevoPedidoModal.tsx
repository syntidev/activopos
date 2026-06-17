'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, X, Plus, Minus, Trash2, User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import styles from './NuevoPedidoModal.module.css'

/* ── Types ── */

interface Client {
  id: number
  name: string
  phone: string | null
}

interface ProductResult {
  id: number
  name: string
  sale_mode: 'unit' | 'weight'
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
}

interface CartItem {
  product_id: number
  product_name: string
  quantity: number
  price_per_unit_usd: number
}

export interface CreatedOrder {
  id: number
  order_number: string
  status: string
  client_name: string | null
  client_phone: string | null
  total_usd: number | string
  created_at: string
  items: { id: number; product_name: string; quantity: number; subtotal_usd: number }[]
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (order: CreatedOrder) => void
}

/* ── Component ── */

export function NuevoPedidoModal({ open, onClose, onCreated }: Props) {
  /* Client */
  const [clientSearch, setClientSearch]     = useState('')
  const [clientResults, setClientResults]   = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const clientTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Products */
  const [productSearch, setProductSearch]   = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const productTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Cart */
  const [items, setItems] = useState<CartItem[]>([])

  /* Notes */
  const [notes, setNotes] = useState('')

  /* Submission */
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  /* Reset on close */
  useEffect(() => {
    if (!open) {
      setClientSearch('')
      setClientResults([])
      setSelectedClient(null)
      setProductSearch('')
      setProductResults([])
      setItems([])
      setNotes('')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  /* ── Client search (300ms debounce) ── */

  const fetchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setClientResults([]); return }
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=5`)
      if (res.ok) {
        const data: { clients?: Client[] } = await res.json()
        setClientResults(data.clients ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleClientInput = (val: string) => {
    setClientSearch(val)
    if (clientTimer.current) clearTimeout(clientTimer.current)
    clientTimer.current = setTimeout(() => fetchClients(val), 300)
  }

  const pickClient = (c: Client) => {
    setSelectedClient(c)
    setClientSearch('')
    setClientResults([])
  }

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

  /* ── Cart actions ── */

  const addProduct = (p: ProductResult) => {
    const price =
      p.sale_mode === 'weight'
        ? (p.price_per_kg_usd ?? 0)
        : (p.price_per_unit_usd ?? 0)

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.id)
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        price_per_unit_usd: price,
      }]
    })
    setProductSearch('')
    setProductResults([])
  }

  const changeQty = (idx: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    )
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  /* ── Total ── */

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.price_per_unit_usd,
    0
  )

  /* ── Submit ── */

  const handleSubmit = async () => {
    if (items.length === 0 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:    selectedClient?.id,
          client_name:  selectedClient?.name,
          client_phone: selectedClient?.phone ?? undefined,
          notes:        notes.trim() || undefined,
          origin:       'pos',
          items: items.map((i) => ({
            product_id:         i.product_id,
            product_name:       i.product_name,
            quantity:           i.quantity,
            price_per_unit_usd: i.price_per_unit_usd,
          })),
        }),
      })
      const data: { ok: boolean; order?: CreatedOrder; error?: string } = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Error al crear el pedido')
        return
      }
      onCreated(data.order!)
      onClose()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Footer (sticky via Modal) ── */

  const footer = (
    <>
      <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={handleSubmit}
        disabled={items.length === 0 || submitting}
        loading={submitting}
      >
        Crear Pedido
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Pedido" size="md" footer={footer}>
      <div className={styles.form}>

        {/* ── Cliente (opcional) ── */}
        <div className={styles.field}>
          <span className={styles.label}>
            Cliente <span className={styles.optional}>(opcional)</span>
          </span>

          {selectedClient ? (
            <div className={styles.chip}>
              <User size={13} aria-hidden="true" className={styles.chipIcon} />
              <span className={styles.chipName}>{selectedClient.name}</span>
              {selectedClient.phone && (
                <span className={styles.chipPhone}>{selectedClient.phone}</span>
              )}
              <button
                type="button"
                className={styles.chipClear}
                onClick={() => setSelectedClient(null)}
                aria-label="Quitar cliente seleccionado"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.inputWrap}>
                <Search size={14} className={styles.inputIcon} aria-hidden="true" />
                <input
                  type="search"
                  className={styles.input}
                  placeholder="Buscar por nombre o teléfono..."
                  value={clientSearch}
                  onChange={(e) => handleClientInput(e.target.value)}
                  autoComplete="off"
                  aria-label="Buscar cliente"
                  aria-autocomplete="list"
                  aria-controls="client-results"
                />
              </div>
              {clientResults.length > 0 && (
                <ul
                  id="client-results"
                  className={styles.results}
                  role="listbox"
                  aria-label="Clientes encontrados"
                >
                  {clientResults.map((c) => (
                    <li key={c.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        className={styles.resultBtn}
                        onClick={() => pickClient(c)}
                      >
                        <span className={styles.resultName}>{c.name}</span>
                        {c.phone && (
                          <span className={styles.resultSub}>{c.phone}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Productos ── */}
        <div className={styles.field}>
          <span className={styles.label}>Productos</span>

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
              aria-autocomplete="list"
              aria-controls="product-results"
            />
          </div>

          {productResults.length > 0 && (
            <ul
              id="product-results"
              className={styles.results}
              role="listbox"
              aria-label="Productos encontrados"
            >
              {productResults.map((p) => {
                const price =
                  p.sale_mode === 'weight'
                    ? p.price_per_kg_usd
                    : p.price_per_unit_usd
                return (
                  <li key={p.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className={styles.resultBtn}
                      onClick={() => addProduct(p)}
                    >
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

          {/* Cart items */}
          {items.length > 0 ? (
            <ul className={styles.cart} aria-label="Productos en el pedido">
              {items.map((item, idx) => (
                <li key={item.product_id} className={styles.cartRow}>
                  <span className={styles.cartName}>{item.product_name}</span>
                  <div className={styles.cartControls}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => changeQty(idx, -1)}
                      aria-label={`Disminuir cantidad de ${item.product_name}`}
                    >
                      <Minus size={11} aria-hidden="true" />
                    </button>
                    <span className={styles.qtyVal} aria-label={`Cantidad: ${item.quantity}`}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => changeQty(idx, 1)}
                      aria-label={`Aumentar cantidad de ${item.product_name}`}
                    >
                      <Plus size={11} aria-hidden="true" />
                    </button>
                    <span className={styles.cartSubtotal} aria-label="Subtotal">
                      ${(item.quantity * item.price_per_unit_usd).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeItem(idx)}
                      aria-label={`Eliminar ${item.product_name} del pedido`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.cartEmpty}>
              Busca y agrega al menos un producto para continuar.
            </p>
          )}
        </div>

        {/* ── Notas (opcional) ── */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pedido-notes">
            Notas <span className={styles.optional}>(opcional)</span>
          </label>
          <textarea
            id="pedido-notes"
            className={styles.textarea}
            placeholder="Instrucciones especiales, dirección de entrega..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {/* ── Total ── */}
        {items.length > 0 && (
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total estimado</span>
            <span className={styles.totalValue} aria-label={`Total: $${total.toFixed(2)}`}>
              ${total.toFixed(2)}
            </span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

      </div>
    </Modal>
  )
}
