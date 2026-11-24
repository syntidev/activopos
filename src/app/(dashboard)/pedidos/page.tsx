'use client'


import { confirmAction } from '@/context/ConfirmContext'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ShoppingBag,
  Plus,
  Phone,
  MessageCircle,
  Clock,
  Package,
  DollarSign,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { NuevoPedidoModal, type CreatedOrder } from './NuevoPedidoModal'
import { CobrarPedidoModal, type InicialCobro } from './CobrarPedidoModal'
import { DespachoBloqueadoModal } from './DespachoBloqueadoModal'
import { PagoBadge } from './PagoBadge'
import type { ApiErrorBody, PedidoPagoFields } from './pago'
import { ShippingActions } from '@/components/comprobante/ShippingActions'
import { ShippingEditor, CedulaAlertBadge, ShippingMethodTag } from '@/components/comprobante/ShippingEditor'
import type { OrderShippingFields } from '@/types/pedidos'
import { OrderDetalleModal, type OrderDetail } from './OrderDetalleModal'
import { FinancingBadge } from '@/components/financing/FinancingBadge'
import { financingFromColumns } from '@/lib/financing-ui'
import type { FinancingColumns } from '@/types/financing'
import { bs, usd } from './money'
import styles from './pedidos.module.css'

/* ── Types ── */

type OrderStatus = 'received' | 'preparing' | 'ready' | 'dispatched'

interface OrderItem {
  id: number
  product_name: string
  variant_label?: string | null
  quantity: number | string
  subtotal_usd: number | string
}

interface Order extends OrderShippingFields, FinancingColumns, PedidoPagoFields {
  id: number
  order_number: string
  status: string
  client_name: string | null
  client_phone: string | null
  delivery_type?: string | null
  total_usd: number | string
  total_bs: number | string
  rate_used: number | string
  created_at: string
  items: OrderItem[]
}

/* ── Constants ── */

const KANBAN_COLS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'received',   label: 'Recibido',   color: styles.colReceived },
  { status: 'preparing',  label: 'Preparando', color: styles.colPreparing },
  { status: 'ready',      label: 'Listo',      color: styles.colReady },
  { status: 'dispatched', label: 'Despachado', color: styles.colDispatched },
]

const STATUS_NEXT: Partial<Record<string, OrderStatus>> = {
  received:  'preparing',
  preparing: 'ready',
  ready:     'dispatched',
}

/* ── Helpers ── */

// Unidades reales del pedido (suma de cantidades), no la cantidad de líneas.
function fmtUnits(items: { quantity: number | string }[]): string {
  const total = items.reduce((acc, i) => acc + Number(i.quantity), 0)
  const shown = Number.isInteger(total) ? String(total) : String(Math.round(total * 1000) / 1000)
  return `${shown} ${total === 1 ? 'ud' : 'uds'}`
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `${h}h${m > 0 ? ` ${m}m` : ''}`
}

function timeUrgency(dateStr: string): 'normal' | 'warning' | 'danger' {
  const diffMin = (Date.now() - new Date(dateStr).getTime()) / 60000
  if (diffMin > 60) return 'danger'
  if (diffMin > 30) return 'warning'
  return 'normal'
}

/* ── Order card ── */

function OrderCard({
  order,
  onDragStart,
  onAdvance,
  onWhatsApp,
  onCobrar,
  onCancelar,
  onOpenDetail,
}: {
  order: Order
  onDragStart: (e: React.DragEvent, order: Order) => void
  onAdvance: (order: Order) => void
  onWhatsApp: (order: Order) => void
  onCobrar: (order: Order) => void
  onCancelar: (order: Order) => void
  onOpenDetail: (order: Order) => void
}) {
  const nextStatus = STATUS_NEXT[order.status]
  const urgency = timeUrgency(order.created_at)
  const urgencyClass = urgency === 'danger'
    ? styles.orderTimeDanger
    : urgency === 'warning'
      ? styles.orderTimeWarning
      : ''

  return (
    <div
      className={styles.orderCard}
      draggable
      onDragStart={(e) => onDragStart(e, order)}
      onClick={() => onOpenDetail(order)}
      role="listitem"
      aria-label={`Pedido ${order.order_number}`}
    >
      <div className={styles.orderHeader}>
        <span className={styles.orderNumber}>{order.order_number}</span>
        <span className={`${styles.orderTime} ${urgencyClass}`}>
          <Clock size={10} aria-hidden="true" />
          {timeAgo(order.created_at)}
        </span>
      </div>

      <p className={styles.orderClient}>
        {order.client_name ?? <span className={styles.muted}>Sin nombre</span>}
      </p>

      {order.client_phone && (
        <p className={styles.orderPhone}>
          <Phone size={11} aria-hidden="true" />
          {order.client_phone}
        </p>
      )}

      {order.items.length > 0 && (
        <ul className={styles.orderLines} aria-label="Resumen de ítems">
          {order.items.slice(0, 2).map((it) => (
            <li key={it.id} className={styles.orderLine}>
              {`${Number(it.quantity)}× ${it.product_name}${it.variant_label ? ` · ${it.variant_label}` : ''}`}
            </li>
          ))}
          {order.items.length > 2 && <li className={styles.orderMore}>+{order.items.length - 2} más</li>}
        </ul>
      )}

      <div className={styles.orderMeta}>
        <span className={styles.orderTotal}>
          <DollarSign size={11} aria-hidden="true" />
          {usd(order.total_usd)} · {bs(order.total_bs)}
        </span>
        <span className={styles.orderItems}>
          <Package size={11} aria-hidden="true" />
          {fmtUnits(order.items)}
        </span>
      </div>

      <div className={styles.orderActions}>
        {nextStatus && (
          <button
            className={styles.advanceBtn}
            onClick={(e) => { e.stopPropagation(); onAdvance(order) }}
            aria-label={`Avanzar pedido ${order.order_number}`}
          >
            {nextStatus === 'preparing'  && '→ Preparar'}
            {nextStatus === 'ready'      && '→ Listo'}
            {nextStatus === 'dispatched' && '→ Despachar'}
          </button>
        )}
        <button
          className={styles.waBtn}
          onClick={(e) => { e.stopPropagation(); onWhatsApp(order) }}
          aria-label="Enviar por WhatsApp"
          title="WhatsApp"
        >
          <MessageCircle size={13} aria-hidden="true" />
        </button>
      </div>

      <CedulaAlertBadge show={order.cedula_alert} />

      {order.pago_estado && <PagoBadge estado={order.pago_estado} pago={order.pago} />}

      {financingFromColumns(order) && <FinancingBadge financing={financingFromColumns(order)!} />}

      {order.delivery_type === 'delivery' && (
        <>
          <ShippingMethodTag label={order.ship_metodo_label} />
          {/* Dispatched = ya salió: la API responde 409, no se ofrece editar. */}
          {order.status !== 'dispatched' && <ShippingEditor orderId={order.id} order={order} />}
          <ShippingActions orderId={order.id} knownDelivery />
        </>
      )}

      <div className={styles.orderActionsCobro}>
        <button
          className={styles.cancelarBtn}
          onClick={(e) => { e.stopPropagation(); onCancelar(order) }}
          aria-label={`Cancelar pedido ${order.order_number}`}
        >
          Cancelar
        </button>
        {/* Cobrar en cualquier etapa, mientras esté por cobrar (con financiamiento rechazado tras cobrar ya hay venta: no se cobra de nuevo). */}
        {(!order.pago_estado || order.pago_estado === 'por_cobrar') && !(order.pago && order.pago.deuda_cliente_usd > 0) && (
          <button
            className={styles.cobrarBtn}
            onClick={(e) => { e.stopPropagation(); onCobrar(order) }}
            aria-label={`Cobrar pedido ${order.order_number}`}
          >
            Cobrar
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Kanban column ── */

function KanbanColumn({
  status,
  label,
  colorClass,
  orders,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onAdvance,
  onWhatsApp,
  onCobrar,
  onCancelar,
  onOpenDetail,
}: {
  status: OrderStatus
  label: string
  colorClass: string
  orders: Order[]
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, status: OrderStatus) => void
  onDragStart: (e: React.DragEvent, order: Order) => void
  onAdvance: (order: Order) => void
  onWhatsApp: (order: Order) => void
  onCobrar: (order: Order) => void
  onCancelar: (order: Order) => void
  onOpenDetail: (order: Order) => void
}) {
  return (
    <div
      className={`${styles.column} ${isDragOver ? styles.columnDragOver : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
      role="list"
      aria-label={`Columna ${label}`}
    >
      <div className={styles.columnHeader}>
        <div className={styles.columnTitleRow}>
          <span className={`${styles.columnDot} ${colorClass}`} aria-hidden="true" />
          <span className={styles.columnLabel}>{label}</span>
        </div>
        <span
          className={`${styles.columnCount} ${status === 'received' && orders.length > 0 ? styles.columnCountNew : ''}`}
          aria-label={`${orders.length} pedidos`}
        >
          {orders.length}
        </span>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={`Sin ${label.toLowerCase()}`} />
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          {orders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <OrderCard
                order={order}
                onDragStart={onDragStart}
                onAdvance={onAdvance}
                onWhatsApp={onWhatsApp}
                onCobrar={onCobrar}
                onCancelar={onCancelar}
                onOpenDetail={onOpenDetail}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}

/* ── Main content ── */

/* ── Loading skeleton ── */
function KanbanSkeleton() {
  return (
    <div className={styles.kanban} aria-busy="true" aria-label="Cargando pedidos">
      {KANBAN_COLS.map(({ status }) => (
        <div key={status} className={styles.column}>
          <div className={`${styles.skeleton} ${styles.skeletonColHeader}`} />
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PedidosContent() {
  const { toast } = useToast()
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [cobrarOrder, setCobrarOrder] = useState<Order | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null)
  const [search, setSearch]         = useState('')
  const draggingRef = useRef<Order | null>(null)
  // Solo un administrador puede despachar sin cobrar (el servidor lo vuelve a validar: 403 OVERRIDE_FORBIDDEN).
  const [isAdmin, setIsAdmin]       = useState(false)
  const [bloqueo, setBloqueo]       = useState<{ order: Order; message: string; error: string; busy: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json() as Promise<{ user?: { role?: string } }>)
      .then(j => setIsAdmin(j.user?.role === 'admin' || j.user?.role === 'super_admin'))
      .catch(() => {})
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100')
      if (res.ok) {
        const data = await res.json()
        const active = (data.orders ?? []).filter(
          (o: Order) => !['delivered', 'cancelled'].includes(o.status)
        )
        setOrders(active)
        setFetchError(null)
      } else {
        setFetchError('No se pudieron cargar los pedidos')
      }
    } catch {
      setFetchError('Error de conexión. Verifica tu red.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  /* ── Drag handlers ── */

  const handleDragStart = (e: React.DragEvent, order: Order) => {
    draggingRef.current = order
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: OrderStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = async (e: React.DragEvent, newStatus: OrderStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    const order = draggingRef.current
    draggingRef.current = null
    if (!order || order.status === newStatus) return
    await updateStatus(order, newStatus)
  }

  /* ── Status update ── */

  type Movido = { ok: true } | { ok: false; status: number; code?: string; message: string }

  /** PATCH de etapa; el mensaje del servidor (422/403) viaja tal cual. override_reason solo lo acepta el admin. */
  const moverPedido = async (order: Order, newStatus: string, overrideReason?: string): Promise<Movido> => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus, ...(overrideReason ? { override_reason: overrideReason } : {}) }),
      })
      if (res.ok) return { ok: true }
      const body = await res.json().catch(() => null) as ApiErrorBody | null
      return { ok: false, status: res.status, code: body?.code, message: body?.error ?? 'No se pudo actualizar el pedido' }
    } catch {
      return { ok: false, status: 0, message: 'Error de conexión' }
    }
  }

  const setEtapa = (id: number, status: string) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))

  const updateStatus = async (order: Order, newStatus: string) => {
    // Despachar sin cobrar casi seguro es rechazado: no se mueve la tarjeta hasta que el servidor responda.
    const sinCobro = newStatus === 'dispatched' && order.pago?.puede_avanzar === false
    if (!sinCobro) setEtapa(order.id, newStatus)
    const r = await moverPedido(order, newStatus)
    if (r.ok) { if (sinCobro) setEtapa(order.id, newStatus); return }
    if (!sinCobro) setEtapa(order.id, order.status) // rollback
    if (r.status === 422 && r.code === 'PAYMENT_REQUIRED') {
      setBloqueo({ order, message: r.message, error: '', busy: false })
      return
    }
    toast(r.message, 'error')
  }

  const despacharSinCobrar = async (reason: string) => {
    if (!bloqueo) return
    const { order } = bloqueo
    setBloqueo({ ...bloqueo, busy: true, error: '' })
    const r = await moverPedido(order, 'dispatched', reason)
    if (r.ok) {
      setEtapa(order.id, 'dispatched')
      setBloqueo(null)
      toast(`Pedido ${order.order_number} despachado sin cobrar`, 'success')
      return
    }
    setBloqueo({ order, message: bloqueo.message, error: r.message, busy: false })
  }

  const handleAdvance = (order: Order) => {
    const next = STATUS_NEXT[order.status]
    if (next) updateStatus(order, next)
  }

  /* ── WhatsApp ── */

  const handleWhatsApp = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}/whatsapp`)
      if (res.ok) {
        const data = await res.json()
        window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      toast('Error al generar enlace', 'error')
    }
  }

  /* ── Cobrar / Cancelar ── */

  const handleCobrarOrder = (order: Order) => {
    setCobrarOrder(order)
  }

  // Devuelve el id de la venta: el modal pasa al paso Comprobante y se cierra
  // solo cuando el cajero pulsa "Listo".
  const handleCobrarConfirm = async (paymentMethodId: number, reference: string, cedula: string | null, initial: InicialCobro | null): Promise<number> => {
    if (!cobrarOrder) throw new Error('No hay pedido seleccionado')
    const res = await fetch(`/api/orders/${cobrarOrder.id}/cobrar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payment_method_id: paymentMethodId, reference: reference || undefined, cedula: cedula || undefined, ...(initial ? { initial } : {}) }),
    })
    const data = await res.json().catch(() => null) as { ok?: boolean; sale_id?: number; error?: string } | null
    if (!res.ok || typeof data?.sale_id !== 'number') {
      throw new Error(data?.error ?? 'Error al cobrar el pedido') // 422/409 del servidor, tal cual
    }
    // Cobrar ya no cambia la etapa: la tarjeta se queda y pasa a "Cobrado" (solo sale si estaba despachado y quedó entregado).
    void fetchOrders()
    toast(`Pedido ${cobrarOrder.order_number} cobrado`, 'success')
    return data.sale_id
  }

  const handleCancelarOrder = async (order: Order) => {
    if (!(await confirmAction({ title: 'Cancelar pedido', message: `¿Cancelar el pedido ${order.order_number}? El pedido saldrá de la lista de pendientes.`, confirmLabel: 'Cancelar pedido', cancelLabel: 'No, volver' }))) return
    // Optimistic remove
    setOrders(prev => prev.filter(o => o.id !== order.id))
    try {
      const res = await fetch(`/api/orders/${order.id}/cancelar`, { method: 'POST' })
      if (!res.ok) {
        // Rollback
        setOrders(prev => [...prev, order])
        toast('No se pudo cancelar el pedido', 'error')
      } else {
        toast(`Pedido ${order.order_number} cancelado`, 'success')
      }
    } catch {
      setOrders(prev => [...prev, order])
      toast('Error de conexión', 'error')
    }
  }

  /* ── Detalle de pedido ── */

  const handleOpenDetail = (order: Order) => setDetailOrderId(order.id)

  const handleOrderUpdated = (updated: OrderDetail) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === updated.id
          ? {
              ...o,
              total_usd: updated.total_usd,
              total_bs: updated.total_bs,
              items: updated.items,
              financing_status: updated.financing_status,
              financing_provider: updated.financing_provider,
              financing_phrase: updated.financing_phrase,
              pago_estado: updated.pago_estado ?? o.pago_estado,
              pago: updated.pago ?? o.pago,
            }
          : o
      )
    )
  }

  /* ── Search + orders by column ── */

  const filteredOrders = search
    ? orders.filter((o) => {
        const q = search.toLowerCase()
        return (
          o.order_number.toLowerCase().includes(q) ||
          (o.client_name ?? '').toLowerCase().includes(q) ||
          o.items.some((it) => it.product_name.toLowerCase().includes(q))
        )
      })
    : orders

  const byStatus = (status: OrderStatus) =>
    filteredOrders.filter((o) => o.status === status)

  return (
    <div className={`${styles.page} page-container-full`}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pedidos</h1>
          <p className={styles.pageSubtitle}>
            {loading ? 'Cargando...' : `${orders.length} pedidos activos`}
          </p>
        </div>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            placeholder="Cliente, número de pedido o producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Buscar pedidos"
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
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() => setModalOpen(true)}
        >
          Nuevo Pedido
        </Button>
      </div>

      {/* Kanban — skeleton → error → empty → content (mutuamente exclusivos) */}
      {loading ? (
        <KanbanSkeleton />
      ) : fetchError ? (
        <div className={styles.errorState}>
          <p className={styles.errorMsg}>{fetchError}</p>
          <button
            className={styles.retryBtn}
            onClick={() => { setLoading(true); void fetchOrders() }}
          >
            Reintentar
          </button>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No hay pedidos activos"
          description="Los pedidos que recibas aparecerán aquí en el tablero."
        />
      ) : (
        <ErrorBoundary>
          <div className={styles.kanban} role="region" aria-label="Tablero Kanban de pedidos">
            {KANBAN_COLS.map(({ status, label, color }) => (
              <KanbanColumn
                key={status}
                status={status}
                label={label}
                colorClass={color}
                orders={byStatus(status)}
                isDragOver={dragOverCol === status}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onAdvance={handleAdvance}
                onWhatsApp={handleWhatsApp}
                onCobrar={handleCobrarOrder}
                onCancelar={handleCancelarOrder}
                onOpenDetail={handleOpenDetail}
              />
            ))}
          </div>
        </ErrorBoundary>
      )}

      {/* Modal: Nuevo Pedido */}
      <NuevoPedidoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(order: CreatedOrder) => {
          setOrders((prev) => [order as Order, ...prev])
        }}
      />

      {/* Modal: Cobrar Pedido */}
      <CobrarPedidoModal
        open={cobrarOrder !== null}
        order={cobrarOrder}
        onClose={() => setCobrarOrder(null)}
        onConfirm={handleCobrarConfirm}
      />

      {/* Aviso: avanzar sin cobrar (422 PAYMENT_REQUIRED). Admin: despachar sin cobrar con motivo; cajero: solo cobrar. */}
      <DespachoBloqueadoModal
        open={bloqueo !== null}
        orderNumber={bloqueo?.order.order_number ?? ''}
        message={bloqueo?.message ?? ''}
        isAdmin={isAdmin}
        busy={bloqueo?.busy ?? false}
        error={bloqueo?.error ?? ''}
        onCobrar={() => { if (bloqueo) { setCobrarOrder(bloqueo.order); setBloqueo(null) } }}
        onOverride={(reason) => { void despacharSinCobrar(reason) }}
        onClose={() => setBloqueo(null)}
      />

      {/* Modal: Detalle de pedido */}
      <OrderDetalleModal
        open={detailOrderId !== null}
        orderId={detailOrderId ?? 0}
        onClose={() => setDetailOrderId(null)}
        onUpdated={handleOrderUpdated}
      />
    </div>
  )
}

export default function PedidosPage() {
  return (
    <ToastProvider>
      <PedidosContent />
    </ToastProvider>
  )
}
