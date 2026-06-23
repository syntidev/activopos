'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CreditCard } from 'lucide-react'
import styles from './CobrarPedidoModal.module.css'

interface PaymentMethod {
  id: number
  name: string
  type: string
  is_active: boolean
}

interface CobrarPedidoModalProps {
  open: boolean
  orderId: number
  orderNumber: string
  totalUsd: number
  totalBs: number
  onClose: () => void
  onConfirm: (paymentMethodId: number, reference: string) => Promise<void>
}

const REFERENCE_TYPES = new Set(['pago_movil', 'zelle', 'transfer', 'binance', 'binance_usdt'])

export function CobrarPedidoModal({
  open,
  orderId: _orderId,
  orderNumber,
  totalUsd,
  totalBs,
  onClose,
  onConfirm,
}: CobrarPedidoModalProps) {
  const [methods, setMethods]       = useState<PaymentMethod[]>([])
  const [selected, setSelected]     = useState<number | null>(null)
  const [reference, setReference]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingPm, setLoadingPm]   = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setReference('')
      setLoading(false)
      return
    }
    setLoadingPm(true)
    fetch('/api/payment-methods')
      .then(r => r.json() as Promise<{ methods?: PaymentMethod[] }>)
      .then(data => {
        const active = (data.methods ?? []).filter(m => m.is_active)
        setMethods(active)
        if (active.length > 0) setSelected(active[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingPm(false))
  }, [open])

  const selectedMethod = methods.find(m => m.id === selected)
  const needsRef = selectedMethod ? REFERENCE_TYPES.has(selectedMethod.type) : false

  const fmtUsd = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtBs = (n: number) =>
    `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await onConfirm(selected, reference.trim())
    } finally {
      setLoading(false)
    }
  }

  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlay}
          aria-modal="true"
          role="dialog"
          aria-label={`Cobrar pedido ${orderNumber}`}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h2 className={styles.title}>Cobrar pedido</h2>
                  <p className={styles.subtitle}>{orderNumber}</p>
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                disabled={loading}
                aria-label="Cerrar"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {/* Total */}
            <div className={styles.totalBlock}>
              <span className={styles.totalUsd}>{fmtUsd(totalUsd)}</span>
              <span className={styles.totalBs}>{fmtBs(totalBs)}</span>
            </div>

            {/* Payment methods */}
            <div className={styles.section}>
              <p className={styles.label}>Método de pago</p>
              {loadingPm ? (
                <div className={styles.skeleton} />
              ) : methods.length === 0 ? (
                <p className={styles.emptyMethods}>
                  Configura métodos de pago en Configuración primero.
                </p>
              ) : (
                <div className={styles.methods} role="radiogroup" aria-label="Método de pago">
                  {methods.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected === m.id}
                      className={`${styles.methodBtn} ${selected === m.id ? styles.methodBtnActive : ''}`}
                      onClick={() => { setSelected(m.id); setReference('') }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reference (conditional) */}
            {needsRef && (
              <div className={styles.section}>
                <label className={styles.label} htmlFor="cobrar-ref">
                  Referencia <span className={styles.optional}>(opcional)</span>
                </label>
                <input
                  id="cobrar-ref"
                  type="text"
                  className={styles.input}
                  placeholder="Nro. de confirmación"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={loading || !selected || loadingPm}
              >
                {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                {loading ? 'Procesando...' : 'Confirmar cobro'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
