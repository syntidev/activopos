'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChefHat, Clock, CheckCheck, RefreshCw, Settings, Utensils, UtensilsCrossed, Pizza, Package, Croissant } from 'lucide-react'
import Link from 'next/link'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './kds.module.css'

/* ── Types ── */

interface OrderItem {
  id: number
  product_name: string
  variant_label?: string | null
  quantity: number | string
}

interface Order {
  id: number
  order_number: string
  status: 'received' | 'preparing' | string
  created_at: string
  notes?: string | null
  client: { id: number; name: string; phone: string | null } | null
  items: OrderItem[]
}

/* ── Helpers ── */

function elapsed(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const m    = Math.floor(secs / 60)
  const s    = Math.floor(secs % 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function isUrgent(iso: string): boolean {
  return (Date.now() - new Date(iso).getTime()) / 1000 > 600 // > 10 min
}

/* ── KDS Activation Screen ── */

function KDSActivation() {
  return (
    <div className={styles.activationPage}>
      <div className={styles.activationCard}>
        <div className={styles.activationIcon} aria-hidden="true">
          <ChefHat size={32} strokeWidth={1.5} />
        </div>
        <h1 className={styles.activationTitle}>Pantalla de Cocina (KDS)</h1>
        <p className={styles.activationDesc}>
          El KDS muestra los pedidos activos en tiempo real para tu equipo de
          cocina o despacho — sin papel, sin malentendidos.
        </p>

        <div className={styles.segmentList} aria-label="Ideal para">
          {[
            { icon: <UtensilsCrossed size={18} />, label: 'Restaurantes y cafeterías' },
            { icon: <Pizza size={18} />, label: 'Cocinas con pedidos por WhatsApp' },
            { icon: <Package size={18} />, label: 'Despacho y preparación de pedidos' },
            { icon: <Croissant size={18} />, label: 'Panaderías y pastelerías' },
          ].map(item => (
            <div key={item.label} className={styles.segmentItem}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.activationCta}>
          <Link href="/configuracion?tab=modulos" className={styles.activateLink}>
            <Settings size={15} aria-hidden="true" />
            Activar KDS en Configuración
          </Link>
          <p className={styles.activationHint}>
            Ve a Configuración → Módulos y activa "Pantalla de Cocina".
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Order card ── */

interface CardProps {
  order: Order
  onAdvance: (id: number, nextStatus: string) => void
  advancing: boolean
}

function OrderCard({ order, onAdvance, advancing }: CardProps) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    setSecs(Math.max(0, (Date.now() - new Date(order.created_at).getTime()) / 1000))
    const t = setInterval(() => {
      setSecs(Math.max(0, (Date.now() - new Date(order.created_at).getTime()) / 1000))
    }, 5000)
    return () => clearInterval(t)
  }, [order.created_at])

  const m      = Math.floor(secs / 60)
  const urgent = secs > 600
  const isPreparing = order.status === 'preparing'
  const nextStatus  = isPreparing ? 'ready' : 'preparing'
  const btnLabel    = isPreparing ? 'Marcar listo' : 'Preparando'

  return (
    <motion.article
      className={`${styles.orderCard} ${urgent ? styles.orderCardUrgent : ''} ${isPreparing ? styles.orderCardPreparing : ''}`}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
    >
      {/* Card header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.orderNum}>{order.order_number}</span>
          {order.client && (
            <span className={styles.clientName}>{order.client.name}</span>
          )}
        </div>
        <div className={styles.timerWrap}>
          <Clock size={12} aria-hidden="true" />
          <span className={`${styles.timer} ${urgent ? styles.timerUrgent : ''}`}>
            {m > 0 ? `${m}m` : `${Math.floor(secs)}s`}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className={styles.statusRow}>
        <span className={`${styles.statusBadge} ${isPreparing ? styles.statusBadgePreparing : styles.statusBadgeReceived}`}>
          {isPreparing ? 'En preparación' : 'Recibido'}
        </span>
        {urgent && (
          <span className={styles.urgentBadge} aria-label="Pedido demorado">
            Demorado
          </span>
        )}
      </div>

      {/* Items */}
      <ul className={styles.itemsList} aria-label={`Ítems del pedido ${order.order_number}`}>
        {order.items.map(it => (
          <li key={it.id} className={styles.itemRow}>
            <span className={styles.itemQty}>{Number(it.quantity)}</span>
            <span className={styles.itemName}>
              {it.product_name}
              {it.variant_label && <span className={styles.variant}> · {it.variant_label}</span>}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className={styles.orderNotes}>{order.notes}</p>
      )}

      {/* Action button */}
      <button
        className={`${styles.advanceBtn} ${isPreparing ? styles.advanceBtnReady : styles.advanceBtnPreparing}`}
        onClick={() => onAdvance(order.id, nextStatus)}
        disabled={advancing}
        type="button"
        aria-label={`${btnLabel} — pedido ${order.order_number}`}
      >
        {advancing
          ? <span className={styles.spinner} aria-hidden="true" />
          : isPreparing
            ? <CheckCheck size={15} aria-hidden="true" />
            : <Utensils size={15} aria-hidden="true" />}
        {advancing ? 'Actualizando…' : btnLabel}
      </button>
    </motion.article>
  )
}

/* ── KDS Board ── */

function KDSBoard() {
  const { toast }     = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState<Set<number>>(new Set())
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/orders?status=received&limit=50'),
        fetch('/api/orders?status=preparing&limit=50'),
      ])
      const all: Order[] = []
      if (r1.ok) { const d = await r1.json() as { orders?: Order[] }; all.push(...(d.orders ?? [])) }
      if (r2.ok) { const d = await r2.json() as { orders?: Order[] }; all.push(...(d.orders ?? [])) }
      // Sort: preparing first, then by age (oldest first)
      all.sort((a, b) => {
        if (a.status === 'preparing' && b.status !== 'preparing') return -1
        if (b.status === 'preparing' && a.status !== 'preparing') return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      setOrders(all)
      setLastRefresh(Date.now())
    } catch {
      if (!silent) toast('Error al cargar pedidos', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchOrders()
    intervalRef.current = setInterval(() => fetchOrders(true), 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchOrders])

  async function handleAdvance(orderId: number, nextStatus: string) {
    setAdvancing(prev => new Set(prev).add(orderId))
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        if (nextStatus === 'ready') {
          setOrders(prev => prev.filter(o => o.id !== orderId))
          toast('Pedido marcado como listo', 'success')
        } else {
          setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, status: nextStatus as Order['status'] } : o
          ))
        }
      } else {
        const d = await res.json() as { error?: string }
        toast(d.error ?? 'Error al actualizar pedido', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setAdvancing(prev => { const n = new Set(prev); n.delete(orderId); return n })
    }
  }

  const received  = orders.filter(o => o.status === 'received')
  const preparing = orders.filter(o => o.status === 'preparing')

  if (loading) {
    return (
      <div className={styles.boardLoading} aria-label="Cargando pedidos…">
        {[0, 1, 2].map(i => <div key={i} className={styles.skeletonCard} />)}
      </div>
    )
  }

  return (
    <div className={styles.board}>
      {/* Toolbar */}
      <div className={styles.boardToolbar}>
        <div className={styles.boardCounts}>
          {preparing.length > 0 && (
            <span className={styles.countBadgePreparing}>{preparing.length} en preparación</span>
          )}
          {received.length > 0 && (
            <span className={styles.countBadgeReceived}>{received.length} recibidos</span>
          )}
          {orders.length === 0 && (
            <span className={styles.countMuted}>Sin pedidos activos</span>
          )}
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchOrders(true)}
          type="button" aria-label="Actualizar pedidos">
          <RefreshCw size={14} aria-hidden="true" />
          <span className={styles.refreshTime}>
            {Math.round((Date.now() - lastRefresh) / 1000)}s
          </span>
        </button>
      </div>

      {orders.length === 0 ? (
        <div className={styles.emptyBoard}>
          <ChefHat size={36} strokeWidth={1.25} aria-hidden="true" />
          <p>Sin pedidos pendientes</p>
          <p className={styles.emptyHint}>Los nuevos pedidos aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          <AnimatePresence>
            {orders.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                onAdvance={handleAdvance}
                advancing={advancing.has(o.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */

function KDSContent() {
  const [kdsEnabled, setKdsEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/config/business/modules')
      .then(r => r.ok ? r.json() as Promise<{ modules_enabled?: string[] }> : Promise.resolve({ modules_enabled: [] as string[] }))
      .then(d => {
        const mods = d.modules_enabled ?? []
        setKdsEnabled(mods.includes('kds'))
      })
      .catch(() => setKdsEnabled(false))
  }, [])

  if (kdsEnabled === null) {
    return <div className={styles.loadingPage} aria-label="Cargando…" />
  }

  if (!kdsEnabled) return <KDSActivation />

  return (
    <div className={styles.kdsPage}>
      <header className={styles.kdsHeader}>
        <div className={styles.headerLeft}>
          <ChefHat size={20} aria-hidden="true" />
          <h1 className={styles.kdsTitle}>Pantalla de Cocina</h1>
        </div>
        <Link href="/configuracion?tab=modulos" className={styles.settingsLink}
          aria-label="Configuración KDS">
          <Settings size={16} aria-hidden="true" />
        </Link>
      </header>
      <KDSBoard />
    </div>
  )
}

export default function KDSPage() {
  return (
    <ToastProvider>
      <KDSContent />
    </ToastProvider>
  )
}
