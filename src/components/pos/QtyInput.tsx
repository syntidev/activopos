'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { useScrollLock } from '@/hooks/useScrollLock'
import type { ProductForPOS } from '@/lib/pos'
import styles from './QtyInput.module.css'

interface QtyInputProps {
  product: ProductForPOS
  rate: number
  onConfirm: (qty: number) => void
  onClose: () => void
}

export function QtyInput({ product, rate, onConfirm, onClose }: QtyInputProps) {
  useScrollLock(true)

  const [value, setValue] = useState('1.000')
  const inputRef = useRef<HTMLInputElement>(null)

  const price = product.price_per_kg_usd ?? 0
  const qty = parseFloat(value) || 0
  const subtotalUsd = qty * price
  const subtotalBs = subtotalUsd * rate

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && qty > 0) { onConfirm(qty); return }
    if (e.key === 'Escape') onClose()
  }

  const step = (delta: number) => {
    setValue((prev) => {
      const n = Math.max(0.001, (parseFloat(prev) || 0) + delta)
      return n.toFixed(3)
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        role="presentation"
      />
      <motion.div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Cantidad para ${product.name}`}
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        <p className={styles.productName}>{product.name}</p>

        <div className={styles.inputRow}>
          <button
            className={styles.stepBtn}
            onClick={() => step(-0.1)}
            type="button"
            aria-label="Reducir 100g"
          >
            <Minus size={20} aria-hidden="true" />
          </button>

          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="number"
              className={styles.qtyInput}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              min="0.001"
              step="0.001"
              aria-label="Kilos"
            />
            <span className={styles.unit}>kg</span>
          </div>

          <button
            className={styles.stepBtn}
            onClick={() => step(0.1)}
            type="button"
            aria-label="Aumentar 100g"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>

        {qty > 0 && (
          <div className={styles.preview}>
            <span className={styles.previewUsd}>${subtotalUsd.toFixed(2)}</span>
            <span className={styles.previewBs}>
              Bs.&nbsp;{subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => qty > 0 && onConfirm(qty)}
            disabled={qty <= 0}
          >
            Agregar al ticket
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
