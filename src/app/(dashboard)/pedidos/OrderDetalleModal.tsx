'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { generarCorteConsumoPDF } from '@/components/pos/CorteConsumoPDF'
import { PriceModeSwitch } from '@/components/pos/PriceModeSwitch'
import { FinancingPanel } from '@/components/financing/FinancingPanel'
import { FINANCING_BCV_NOTE, ITEMS_EDIT_WARNING, financingFromColumns, isFinancingLive, patchFinancing } from '@/lib/financing-ui'
import type { PriceMode, PriceSource } from '@/lib/pos'
import { priceForMode, variantBases } from '@/lib/pricing'
import { bs, dual, usd } from './money'
import { ClienteResumen } from './ClienteResumen'
import { PagoResumen } from './PagoBadge'
import type { PedidoClienteResumen, PedidoPagoFields } from './pago'
import type { BlockedProduct, FinancingAction, FinancingColumns, TicketFinancing } from '@/types/financing'
import styles from './NuevoPedidoModal.module.css'
import d from './OrderDetalleModal.module.css'

/* ── Types ── */

interface ProductVariant {
  id: number
  valor: string
  sku: string | null
  stock: number
  precio_extra: number
  price_usd: number | null
  divisa_price_usd: number | null
}

interface ProductResult {
  id: number
  name: string
  sku: string | null
  sale_mode: 'unit' | 'weight'
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
  wholesale_price_usd: number | null
  wholesale_price_per_kg_usd: number | null
  images: string[] | null
  variants: ProductVariant[]
  stock?: { net_qty: number }
}

interface EditableItem {
  /** id de la línea en el servidor (los ítems recién agregados no lo tienen hasta guardar). */
  id?: number
  product_id: number
  product_name: string
  variant_id?: number | null
  variant_label?: string | null
  /** Primera foto y SKU (de la variante o del producto), solo para mostrar. */
  image_url?: string | null
  sku?: string | null
  quantity: number
  price_per_unit_usd: number
  price_source?: PriceSource | null
}

/** Línea del `ticket` que devuelve PATCH /api/orders/{id}/price-mode. */
interface PricedLine {
  id: number
  product_id: number
  variant_id: number | null
  price_per_unit_usd: number
  price_source: PriceSource
}

export interface OrderDetail extends FinancingColumns, PedidoPagoFields {
  id: number
  order_number: string
  status: string
  client_name: string | null
  client_phone?: string | null
  client_cedula?: string | null
  /** Resumen del cliente enlazado; null si el pedido no tiene cliente. */
  client?: PedidoClienteResumen | null
  total_usd: number | string
  total_bs: number | string
  rate_used?: number | string
  price_mode?: PriceMode
  items: {
    id: number
    price_source?: PriceSource | null
    product_id: number
    product_name: string
    variant_id?: number | null
    variant_label: string | null
    image_url?: string | null
    sku?: string | null
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

const lineKey = (i: { product_id: number; variant_id?: number | null }): string => `${i.product_id}:${i.variant_id ?? 0}`

/** Línea del servidor → línea editable; `prev` conserva foto/SKU, que el PATCH de ítems no devuelve. */
function toEditable(i: OrderDetail['items'][number], prev?: EditableItem): EditableItem {
  return {
    id:                 i.id,
    product_id:         i.product_id,
    product_name:       i.product_name,
    variant_id:         i.variant_id ?? null,
    variant_label:      i.variant_label,
    image_url:          i.image_url ?? prev?.image_url ?? null,
    sku:                i.sku ?? prev?.sku ?? null,
    quantity:           Number(i.quantity),
    price_per_unit_usd: Number(i.price_per_unit_usd),
    price_source:       i.price_source,
  }
}

function Thumb({ url, name }: { url?: string | null; name: string }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" width={40} height={40} className={d.thumb} loading="lazy" />
    : <span className={d.thumbEmpty} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
}

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
  const [financing, setFinancing]     = useState<TicketFinancing | null>(null)
  const [divisaActive, setDivisaActive] = useState(true)
  const [finBusy, setFinBusy]         = useState(false)
  const [finError, setFinError]       = useState('')
  const [finBlocked, setFinBlocked]   = useState<BlockedProduct[]>([])
  // Sin método de pago financiador (Configuración > Cobros) no se ofrece pedir Cashea.
  const [hasFinancier, setHasFinancier] = useState(false)

  const [pickingId, setPickingId] = useState<number | null>(null)
  const [undo, setUndo] = useState<{ item: EditableItem; idx: number } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

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
        setFinancing(financingFromColumns(data.order))
        setItems(data.order.items.map((i) => toEditable(i)))
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))

    fetch('/api/payment-methods')
      .then((r) => r.json())
      .then((j: { methods?: { is_financing?: boolean }[] }) => setHasFinancier((j.methods ?? []).some((m) => m.is_financing === true)))
      .catch(() => {})

    fetch('/api/config/business')
      .then((r) => r.json())
      .then((j: { business?: { name?: string; cobro?: { divisaActive?: boolean } } }) => {
        if (j.business?.name) setBusinessName(j.business.name)
        setDivisaActive(j.business?.cobro?.divisaActive !== false)
      })
      .catch(() => {})
  }, [open, orderId])

  useEffect(() => {
    if (!open) {
      setOrder(null)
      setItems([])
      setError('')
      setFinancing(null)
      setFinError('')
      setFinBlocked([])
      setProductSearch('')
      setProductResults([])
      setPickingId(null)
      setUndo(null)
      setConfirmClose(false)
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

  const addProduct = (p: ProductResult, v?: ProductVariant) => {
    // Precio estimado para mostrar; al guardar el servidor reprecia con la variante.
    const price = priceForMode(variantBases(p, v, p.sale_mode), priceMode).price
    const line: EditableItem = {
      product_id: p.id, product_name: p.name, variant_id: v?.id ?? null, variant_label: v?.valor ?? null,
      image_url: p.images?.[0] ?? null, sku: v?.sku ?? p.sku, quantity: 1, price_per_unit_usd: price,
    }
    setItems((prev) => {
      const idx = prev.findIndex((i) => lineKey(i) === lineKey(line))
      if (idx >= 0) {
        return prev.map((item, i) => (i === idx ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prev, line]
    })
    setProductSearch('')
    setProductResults([])
    setPickingId(null)
  }

  const changeQty = (idx: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    )
  }

  // Eliminar no pide confirmación: avisa con "Deshacer" durante 5 s.
  const removeItem = (idx: number) => {
    setUndo({ item: items[idx], idx })
    setItems((prev) => prev.filter((_, i) => i !== idx))
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }

  const undoRemove = () => {
    if (!undo) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setItems((prev) => { const next = [...prev]; next.splice(Math.min(undo.idx, next.length), 0, undo.item); return next })
    setUndo(null)
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.price_per_unit_usd, 0)
  const rate  = order ? Number(order.rate_used ?? 0) || (Number(order.total_usd) > 0 ? Number(order.total_bs) / Number(order.total_usd) : 0) : 0
  const priceMode: PriceMode = order?.price_mode === 'divisa' ? 'divisa' : 'bcv'
  // El servidor reprecia lo guardado: con cambios de ítems sin guardar el modo no se puede cambiar.
  const dirty = order !== null && (items.length !== order.items.length
    || items.some((it, i) => lineKey(it) !== lineKey(order.items[i]) || it.quantity !== Number(order.items[i].quantity)))

  // Cerrar con cambios de ítems sin guardar pide confirmación.
  const handleClose = () => { if (dirty && editable) setConfirmClose(true); else onClose() }
  // Total del pedido en el modo activo (lo que ya sabemos sin llamar al servidor); el otro modo se ve al cambiarlo.
  const modeTotals: Partial<Record<PriceMode, string>> = { [priceMode]: dual(total, rate) }

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
      setItems((prev) => prev.map((it) => {
        const hit = lines.find((l) => l.id === it.id)
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

  /* ── Financiamiento (Cashea): pedir, aprobar, rechazar o retirar; el servidor valida y devuelve el estado ── */

  /** Vuelve a leer el pago y el cliente: rechazar Cashea tras cobrar cambia el saldo (pasa a deuda del cliente). */
  const refreshPago = async (): Promise<Pick<OrderDetail, 'pago_estado' | 'pago' | 'client'>> => {
    try {
      const j = await (await fetch(`/api/orders/${orderId}`)).json() as { order?: OrderDetail }
      if (j.order) return { pago_estado: j.order.pago_estado, pago: j.order.pago, client: j.order.client }
    } catch { /* se queda con lo que ya se mostraba */ }
    return {}
  }

  const handleFinancing = async (action: FinancingAction) => {
    if (!order || finBusy) return
    setFinBusy(true)
    setFinError('')
    setFinBlocked([])
    const result = await patchFinancing('orders', orderId, action)
    setFinBusy(false)
    if (!result.ok) {
      setFinError(result.error ?? 'No se pudo cambiar el financiamiento.')
      setFinBlocked(result.blocked_products ?? [])
      return
    }
    setFinancing(result.financing)
    const fresh = await refreshPago()
    const next: OrderDetail = {
      ...order,
      price_mode:         'bcv',
      financing_status:   result.financing?.status ?? null,
      financing_provider: result.financing?.provider ?? null,
      financing_phrase:   result.financing?.phrase ?? null,
      ...fresh,
    }
    setOrder(next)
    onUpdated(next)
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
            variant_id:    i.variant_id ?? undefined,
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
      // Un pedido aprobado por Cashea vuelve a "solicitado" al cambiar sus ítems.
      setFinancing(financingFromColumns(data.order))
      // El servidor recrea las líneas al guardar: se toman sus ids nuevos para poder mapear el cambio de modo por id.
      const prevByKey = new Map(items.map((i) => [lineKey(i), i]))
      setItems(data.order.items.map((i) => toEditable(i, prevByKey.get(lineKey(i)))))
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
      <Button variant="ghost" size="md" onClick={handleClose}>
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
    <>
    <Modal
      open={open}
      onClose={handleClose}
      title={order ? `Pedido ${order.order_number}` : 'Pedido'}
      size="detail"
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
                  <ul className={d.results} role="listbox" aria-label="Productos encontrados">
                    {productResults.map((p) => {
                      const hasVariants = p.variants.length > 0
                      const base = priceForMode(variantBases(p, undefined, p.sale_mode), priceMode).price
                      const sub = [p.sku ? `SKU ${p.sku}` : null, hasVariants ? `${p.variants.length} variantes: elige una` : p.stock ? `Stock ${p.stock.net_qty}` : null].filter(Boolean).join(' · ')
                      return (
                        <li key={p.id} role="option" aria-selected={false}>
                          <button type="button" className={d.result} onClick={() => (hasVariants ? setPickingId(pickingId === p.id ? null : p.id) : addProduct(p))}>
                            <Thumb url={p.images?.[0]} name={p.name} />
                            <span className={d.info}>
                              <span className={d.name}>{p.name}</span>
                              {sub && <span className={d.sub}>{sub}</span>}
                              {!hasVariants && <span className={d.unit}>{base > 0 ? dual(base, rate) : '—'}</span>}
                            </span>
                          </button>
                          {hasVariants && pickingId === p.id && (
                            <div className={d.variantList}>
                              {p.variants.map((v) => {
                                const vp = priceForMode(variantBases(p, v, p.sale_mode), priceMode).price
                                return (
                                  <button key={v.id} type="button" className={d.variantBtn} onClick={() => addProduct(p, v)}>
                                    <span>
                                      <span className={d.variant}>{v.valor}</span>
                                      {v.sku ? ` · SKU ${v.sku}` : ''} · {v.stock > 0 ? `Stock ${v.stock}` : <span className={d.stockOut}>Sin stock</span>}
                                    </span>
                                    <span className={d.unit}>{vp > 0 ? dual(vp, rate) : '—'}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            <ClienteResumen client={order.client ?? null} fallbackPhone={order.client_phone} fallbackCedula={order.client_cedula} rate={rate} />

            <div className={styles.field}>
              <span className={styles.label}>Ítems del pedido</span>
              {items.length > 0 ? (
                <ul className={styles.cart} aria-label="Ítems del pedido">
                  {items.map((item, idx) => (
                    <li key={`${lineKey(item)}-${idx}`} className={d.row}>
                      <Thumb url={item.image_url} name={item.product_name} />
                      <div className={d.info}>
                        <span className={d.name}>{item.product_name}</span>
                        {(item.variant_label || item.sku) && (
                          <span className={d.sub}>
                            {item.variant_label && <span className={d.variant}>{item.variant_label}</span>}
                            {item.variant_label && item.sku && ' · '}
                            {item.sku && `SKU ${item.sku}`}
                          </span>
                        )}
                        <span className={d.unit}>
                          {usd(item.price_per_unit_usd)} c/u{rate > 0 && ` · ${bs(item.price_per_unit_usd * rate)}`}
                        </span>
                        {(item.price_source === 'manual' || item.price_source === 'fallback_bcv') && (
                          <span>
                            {item.price_source === 'manual' && <span className={styles.lineTag}>Manual</span>}
                            {item.price_source === 'fallback_bcv' && (
                              <span className={styles.lineTag} title="Este producto no tiene precio Divisa: se cobra a precio BCV">Sin precio Divisa</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className={d.foot}>
                        <div className={d.qty}>
                          {editable ? (
                            <>
                              <button type="button" className={styles.qtyBtn} onClick={() => changeQty(idx, -1)} aria-label={`Disminuir cantidad de ${item.product_name} ${item.variant_label ?? ''}`}>
                                <Minus size={11} aria-hidden="true" />
                              </button>
                              <span className={styles.qtyVal}>{item.quantity}</span>
                              <button type="button" className={styles.qtyBtn} onClick={() => changeQty(idx, 1)} aria-label={`Aumentar cantidad de ${item.product_name} ${item.variant_label ?? ''}`}>
                                <Plus size={11} aria-hidden="true" />
                              </button>
                              <button type="button" className={styles.removeBtn} onClick={() => removeItem(idx)} aria-label={`Eliminar ${item.product_name} ${item.variant_label ?? ''} del pedido`}>
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <span className={styles.qtyVal}>{item.quantity}×</span>
                          )}
                        </div>
                        <span className={d.lineTotal} data-testid="line-total">
                          {usd(item.quantity * item.price_per_unit_usd)}
                          {rate > 0 && <span className={d.lineBs}>{bs(item.quantity * item.price_per_unit_usd * rate)}</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.cartEmpty}>Sin ítems.</p>
              )}
              {undo && (
                <div className={d.undo} role="status">
                  <span>Quitaste {undo.item.product_name}{undo.item.variant_label ? ` · ${undo.item.variant_label}` : ''}</span>
                  <button type="button" className={d.undoBtn} onClick={undoRemove}>Deshacer</button>
                </div>
              )}
            </div>

            {divisaActive && <PriceModeSwitch
              mode={priceMode}
              onChange={modeEditable && !isFinancingLive(financing) ? handlePriceMode : undefined}
              readOnly={!modeEditable || isFinancingLive(financing)}
              busy={modeBusy}
              error={modeError}
              fallbackLines={items.filter((i) => i.price_source === 'fallback_bcv').length}
              totals={modeTotals}
            />}
            {isFinancingLive(financing) && (
              <p className={styles.cartEmpty} role="note" data-testid="financing-bcv-note">{FINANCING_BCV_NOTE}</p>
            )}

            {order.pago_estado && order.pago && <PagoResumen estado={order.pago_estado} pago={order.pago} rate={rate} />}

            <FinancingPanel
              rejectQuestion={order.pago_estado === 'cobrado' && (order.pago?.cashea_asignado_usd ?? 0) > 0
                ? `¿Rechazar Cashea? El saldo de ${usd(order.pago?.cashea_asignado_usd ?? 0)} asignado a Cashea vuelve a ser deuda del cliente.`
                : undefined}
              financing={financing}
              onAction={handleFinancing}
              busy={finBusy}
              error={finError}
              blocked={finBlocked}
              canRequest={hasFinancier && modeEditable}
              readOnly={!modeEditable}
              editWarning={ITEMS_EDIT_WARNING}
            />

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>
                {usd(total)}
                {rate > 0 && <span className={styles.totalBs}>{bs(total * rate)}</span>}
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
    <ConfirmDialog
      open={confirmClose}
      title="Tienes cambios sin guardar"
      message="Cambiaste los ítems de este pedido y no los guardaste. Si cierras ahora se pierden."
      confirmLabel="Cerrar sin guardar"
      cancelLabel="Seguir editando"
      onConfirm={() => { setConfirmClose(false); onClose() }}
      onCancel={() => setConfirmClose(false)}
    />
    </>
  )
}
