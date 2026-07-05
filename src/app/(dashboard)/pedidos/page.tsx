'use client'

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
import { CobrarPedidoModal } from './CobrarPedidoModal'
import styles from './pedidos.module.css'

/* ── Types ── */

type OrderStatus = 'received' | 'preparing' | 'ready' | 'dispatched'

interface OrderItem {
  id: number
  product_name: string
  quantity: number | string
  subtotal_usd: number | string
}

interface Order {
  id: number
  order_number: string
  status: string
  client_name: string | null
  client_phone: string | null
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

const fmtUsd = (n: number | string) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
}: {
  order: Order
  onDragStart: (e: React.DragEvent, order: Order) => void
  onAdvance: (order: Order) => void
  onWhatsApp: (order: Order) => void
  onCobrar: (order: Order) => void
  onCancelar: (order: Order) => void
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

      <div className={styles.orderMeta}>
        <span className={styles.orderTotal}>
          <DollarSign size={11} aria-hidden="true" />
          {fmtUsd(order.total_usd)}
        </span>
        <span className={styles.orderItems}>
          <Package size={11} aria-hidden="true" />
          {order.items.length} {order.items.length === 1 ? 'ítem' : 'ítems'}
        </span>
      </div>

      <div className={styles.orderActions}>
        {nextStatus && (
          <button
            className={styles.advanceBtn}
            onClick={() => onAdvance(order)}
            aria-label={`Avanzar pedido ${order.order_number}`}
          >
            {nextStatus === 'preparing'  && '→ Preparar'}
            {nextStatus === 'ready'      && '→ Listo'}
            {nextStatus === 'dispatched' && '→ Despachar'}
          </button>
        )}
        <button
          className={styles.waBtn}
          onClick={() => onWhatsApp(order)}
          aria-label="Enviar por WhatsApp"
          title="WhatsApp"
        >
          <MessageCircle size={13} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.orderActionsCobro}>
        <button
          className={styles.cancelarBtn}
          onClick={() => onCancelar(order)}
          aria-label={`Cancelar pedido ${order.order_number}`}
        >
          Cancelar
        </button>
        <button
          className={styles.cobrarBtn}
          onClick={() => onCobrar(order)}
          aria-label={`Cobrar pedido ${order.order_number}`}
        >
          Cobrar
        </button>
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
  const [search, setSearch]         = useState('')
  const draggingRef = useRef<Order | null>(null)

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

  const updateStatus = async (order: Order, newStatus: string) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
    )
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        // Rollback
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o))
        )
        toast('No se pudo actualizar el pedido', 'error')
      }
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o))
      )
      toast('Error de conexión', 'error')
    }
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

  const handleCobrarConfirm = async (paymentMethodId: number, reference: string) => {
    if (!cobrarOrder) return
    const res = await fetch(`/api/orders/${cobrarOrder.id}/cobrar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payment_method_id: paymentMethodId, reference: reference || undefined }),
    })
    if (res.ok) {
      setOrders(prev => prev.filter(o => o.id !== cobrarOrder.id))
      setCobrarOrder(null)
      toast(`Pedido ${cobrarOrder.order_number} cobrado`, 'success')
    } else {
      const data = await res.json() as { error?: string }
      toast(data.error ?? 'Error al cobrar el pedido', 'error')
      throw new Error(data.error ?? 'cobrar failed')
    }
  }

  const handleCancelarOrder = async (order: Order) => {
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
        orderId={cobrarOrder?.id ?? 0}
        orderNumber={cobrarOrder?.order_number ?? ''}
        totalUsd={Number(cobrarOrder?.total_usd ?? 0)}
        totalBs={Number(cobrarOrder?.total_bs ?? 0)}
        onClose={() => setCobrarOrder(null)}
        onConfirm={handleCobrarConfirm}
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
