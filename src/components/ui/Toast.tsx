'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Toast.module.css'

/* ── Types ── */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration?: number
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void
}

/* ── Context ── */

const ToastContext = createContext<ToastContextValue | null>(null)

/* ── Provider ── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev, { id, variant, message, duration }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={styles.region} role="region" aria-label="Notificaciones" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/* ── Hook ── */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

/* ── Icons map ── */

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle  size={16} strokeWidth={2} aria-hidden="true" />,
  error:   <XCircle      size={16} strokeWidth={2} aria-hidden="true" />,
  warning: <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />,
  info:    <Info          size={16} strokeWidth={2} aria-hidden="true" />,
}

/* ── Single toast card ── */

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      className={`${styles.toast} ${styles[`variant-${item.variant}`]}`}
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      layout
    >
      <span className={styles.icon}>{ICONS[item.variant]}</span>
      <p className={styles.message}>{item.message}</p>
      <button
        className={styles.dismiss}
        onClick={() => onDismiss(item.id)}
        aria-label="Cerrar notificación"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </motion.div>
  )
}
