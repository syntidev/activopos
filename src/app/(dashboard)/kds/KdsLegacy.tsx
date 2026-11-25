'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChefHat, Clock, CheckCheck, RefreshCw, Settings,
  Utensils, UtensilsCrossed, Pizza, Package, Croissant,
} from 'lucide-react'
import Link from 'next/link'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { playBeep } from '@/lib/audio'
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

/* ── Constants ── */

const OVERFLOW_SECS  = 45 * 60  // 45 min → warning (orange)
const EMERGENCY_SECS = 90 * 60  // 90 min → danger (red, pulsing)

// Frontend STATUS_FLOW — bump via PATCH /api/orders/{id} with { status }
// /api/kds/bump does not exist; keep using PATCH /api/orders/{id}
const STATUS_FLOW: Record<string, string> = {
  received:  'preparing',
  preparing: 'ready',
}

/* ── Helpers ── */

function elapsedSecs(createdAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
}

function fmtElapsed(secs: number): string {
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    return `${h}h${m}m`
  }
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

type Urgency = 'normal' | 'overflow' | 'emergency'

function getUrgency(secs: number): Urgency {
  if (secs >= EMERGENCY_SECS) return 'emergency'
  if (secs >= OVERFLOW_SECS)  return 'overflow'
  return 'normal'
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
            { icon: <Pizza size={18} />,           label: 'Cocinas con pedidos por WhatsApp' },
            { icon: <Package size={18} />,         label: 'Despacho y preparación de pedidos' },
            { icon: <Croissant size={18} />,       label: 'Panaderías y pastelerías' },
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
            Ve a Configuración → Módulos y activa &quot;Pantalla de Cocina&quot;.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Order card ── */

interface CardProps {
  order:     Order
  now:       number
  onAdvance: (id: number, nextStatus: string) => void
  advancing: boolean
}

function OrderCard({ order, now, onAdvance, advancing }: CardProps) {
  const secs    = elapsedSecs(order.created_at, now)
  const urgency = getUrgency(secs)
  const isPreparing = order.status === 'preparing'
  const nextStatus  = STATUS_FLOW[order.status] ?? 'preparing'
  const btnLabel    = isPreparing ? 'Marcar listo' : 'Preparando'

  const timerWrapClass = [
    styles.timerWrap,
    urgency === 'overflow'  ? styles.timerWrapOverflow  : '',
    urgency === 'emergency' ? styles.timerWrapEmergency : '',
  ].filter(Boolean).join(' ')

  const timerClass = [
    styles.timer,
    urgency === 'overflow'  ? styles.timerOverflow  : '',
    urgency === 'emergency' ? styles.timerEmergency : '',
  ].filter(Boolean).join(' ')

  return (
    <motion.article
      className={`${styles.orderCard} ${isPreparing ? styles.orderCardPreparing : ''} ${urgency === 'emergency' ? styles.orderCardEmergency : ''}`}
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
        <div className={timerWrapClass}>
          <Clock size={12} aria-hidden="true" />
          <span className={timerClass} aria-label={`Tiempo: ${fmtElapsed(secs)}`}>
            {fmtElapsed(secs)}
          </span>
        </div>
      </div>

      {/* Status + urgency badges */}
      <div className={styles.statusRow}>
        <span className={`${styles.statusBadge} ${isPreparing ? styles.statusBadgePreparing : styles.statusBadgeReceived}`}>
          {isPreparing ? 'En preparación' : 'Recibido'}
        </span>
        {urgency === 'emergency' && (
          <span className={styles.urgentBadge} aria-label="Pedido crítico — más de 90 minutos">
            Crítico
          </span>
        )}
        {urgency === 'overflow' && (
          <span className={`${styles.urgentBadge} ${styles.urgentBadgeOverflow}`} aria-label="Pedido demorado — más de 45 minutos">
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
  const { toast } = useToast()
  const [orders,   setOrders]   = useState<Order[]>([])
  const [loading,  setLoading]  = useState(true)
  const [advancing, setAdvancing] = useState<Set<number>>(new Set())
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  // Shared 1-second clock — drives all card timers without per-card intervals
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevIdsRef   = useRef<Set<number>>(new Set())
  const isFirstFetch = useRef(true)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/orders?status=received&send_to_kds=true&limit=50'),
        fetch('/api/orders?status=preparing&send_to_kds=true&limit=50'),
      ])
      const all: Order[] = []
      if (r1.ok) { const d = await r1.json() as { orders?: Order[] }; all.push(...(d.orders ?? [])) }
      if (r2.ok) { const d = await r2.json() as { orders?: Order[] }; all.push(...(d.orders ?? [])) }

      all.sort((a, b) => {
        if (a.status === 'preparing' && b.status !== 'preparing') return -1
        if (b.status === 'preparing' && a.status !== 'preparing') return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      // Beep on new orders — skip first fetch to avoid false positives on page load
      if (!isFirstFetch.current) {
        const newOrders = all.filter(o => !prevIdsRef.current.has(o.id))
        if (newOrders.length > 0) playBeep(880, 100)
      }
      isFirstFetch.current = false
      prevIdsRef.current = new Set(all.map(o => o.id))

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
          prevIdsRef.current = new Set(Array.from(prevIdsRef.current).filter(id => id !== orderId))
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
        <button
          className={styles.refreshBtn}
          onClick={() => fetchOrders(true)}
          type="button"
          aria-label="Actualizar pedidos"
        >
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
                now={now}
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
      .then(r => r.ok
        ? r.json() as Promise<{ modules_enabled?: string[] }>
        : Promise.resolve({ modules_enabled: [] as string[] }))
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
