'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, AlertCircle, Package, Info, CheckCheck } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'
import type { NotificationItem } from '@/hooks/useNotifications'
import styles from './NotificationsPanel.module.css'

interface NotificationsPanelProps {
  open:        boolean
  onClose:     () => void
  items:       NotificationItem[]
  loading:     boolean
  onMarkAll:   () => Promise<void>
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return 'Ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  const h = Math.floor(diff / 3600)
  return `hace ${h}h`
}

const TYPE_ICONS = {
  credit_vencido: AlertCircle,
  low_stock:      Package,
  info:           Info,
} as const

export function NotificationsPanel({
  open, onClose, items, loading, onMarkAll,
}: NotificationsPanelProps) {
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const unread = items.filter(n => !n.read_at).length

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Notificaciones"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <Bell size={16} aria-hidden="true" />
                <h2 className={styles.title}>
                  Notificaciones{unread > 0 ? ` (${unread})` : ''}
                </h2>
              </div>
              <div className={styles.headerActions}>
                {unread > 0 && (
                  <button
                    type="button"
                    className={styles.markAllBtn}
                    onClick={onMarkAll}
                    aria-label="Marcar todas como leídas"
                  >
                    <CheckCheck size={14} aria-hidden="true" />
                    Marcar leídas
                  </button>
                )}
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Cerrar panel"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={styles.body}>
              {loading ? (
                <div className={styles.empty}>
                  <span className={styles.loadingSpinner} aria-hidden="true" />
                </div>
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <Bell size={28} className={styles.emptyIcon} aria-hidden="true" />
                  <p className={styles.emptyTitle}>Sin notificaciones</p>
                  <p className={styles.emptySub}>Todo al día por ahora.</p>
                </div>
              ) : (
                <ul className={styles.list} role="list">
                  {items.map(n => {
                    const Icon = TYPE_ICONS[n.type] ?? Info
                    return (
                      <li
                        key={n.id}
                        className={`${styles.item} ${!n.read_at ? styles.itemUnread : ''}`}
                      >
                        <div className={`${styles.itemIcon} ${styles[`icon_${n.type}`]}`} aria-hidden="true">
                          <Icon size={15} />
                        </div>
                        <div className={styles.itemBody}>
                          <p className={styles.itemTitle}>{n.title}</p>
                          <p className={styles.itemDesc}>{n.body}</p>
                          <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                        </div>
                        {!n.read_at && <span className={styles.unreadDot} aria-label="No leído" />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
