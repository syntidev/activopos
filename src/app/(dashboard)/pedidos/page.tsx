'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ShoppingBag,
  Plus,
  Phone,
  MessageCircle,
  Clock,
  Package,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { NuevoPedidoModal, type CreatedOrder } from './NuevoPedidoModal'
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

/* ── Order card ── */

function OrderCard({
  order,
  onDragStart,
  onAdvance,
  onWhatsApp,
}: {
  order: Order
  onDragStart: (e: React.DragEvent, order: Order) => void
  onAdvance: (order: Order) => void
  onWhatsApp: (order: Order) => void
}) {
  const nextStatus = STATUS_NEXT[order.status]

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
        <span className={styles.orderTime}>
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
        <span className={styles.columnCount} aria-label={`${orders.length} pedidos`}>
          {orders.length}
        </span>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Sin pedidos" />
      ) : (
        orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onDragStart={onDragStart}
            onAdvance={onAdvance}
            onWhatsApp={onWhatsApp}
          />
        ))
      )}
    </div>
  )
}

/* ── Main content ── */

function PedidosContent() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const draggingRef = useRef<Order | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100')
      if (res.ok) {
        const data = await res.json()
        // Only show active (non-delivered/cancelled) statuses in kanban
        const active = (data.orders ?? []).filter(
          (o: Order) => !['delivered', 'cancelled'].includes(o.status)
        )
        setOrders(active)
      }
    } catch {
      /* keep previous state */
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
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      toast('Error al generar enlace', 'error')
    }
  }

  /* ── Orders by column ── */

  const byStatus = (status: OrderStatus) =>
    orders.filter((o) => o.status === status)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pedidos</h1>
          <p className={styles.pageSubtitle}>
            {loading ? 'Cargando...' : `${orders.length} pedidos activos`}
          </p>
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

      {/* Kanban board */}
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
          />
        ))}
      </div>

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className={styles.emptyState}>
          <ShoppingBag size={36} aria-hidden="true" className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No hay pedidos activos</p>
          <p className={styles.emptyDesc}>
            Los pedidos que recibas aparecerán aquí en el tablero.
          </p>
        </div>
      )}

      {/* Modal: Nuevo Pedido */}
      <NuevoPedidoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(order: CreatedOrder) => {
          setOrders((prev) => [order as Order, ...prev])
        }}
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
