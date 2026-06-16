'use client'

import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import styles from './DescuentoModal.module.css'

interface DescuentoModalProps {
  open: boolean
  onClose: () => void
  currentPct: number
  totalUsd: number
  onApply: (pct: number) => void
}

export function DescuentoModal({ open, onClose, currentPct, totalUsd, onApply }: DescuentoModalProps) {
  const [type, setType] = useState<'pct' | 'fixed'>('pct')
  const [value, setValue] = useState(currentPct > 0 ? String(currentPct) : '')

  const num = parseFloat(value) || 0
  const pct = type === 'pct' ? num : totalUsd > 0 ? (num / totalUsd) * 100 : 0
  const previewUsd = totalUsd * (pct / 100)

  const handleApply = () => {
    onApply(Math.min(99.99, Math.max(0, pct)))
    onClose()
  }

  const handleRemove = () => { onApply(0); onClose() }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aplicar Descuento"
      size="sm"
      footer={
        <div className={styles.footer}>
          {currentPct > 0 && (
            <Button variant="danger" onClick={handleRemove}>Quitar descuento</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleApply} disabled={num <= 0}>
            Aplicar
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <div className={styles.typeToggle}>
          <button
            className={`${styles.typeBtn} ${type === 'pct' ? styles.typeBtnActive : ''}`}
            onClick={() => { setType('pct'); setValue('') }}
            type="button"
          >
            Porcentaje (%)
          </button>
          <button
            className={`${styles.typeBtn} ${type === 'fixed' ? styles.typeBtnActive : ''}`}
            onClick={() => { setType('fixed'); setValue('') }}
            type="button"
          >
            Monto fijo ($)
          </button>
        </div>

        <div className={styles.inputWrapper}>
          <span className={styles.prefix}>{type === 'pct' ? '%' : '$'}</span>
          <input
            type="number"
            className={styles.valueInput}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min="0"
            max={type === 'pct' ? '99.99' : undefined}
            step="0.01"
            autoFocus
            aria-label={type === 'pct' ? 'Porcentaje de descuento' : 'Monto de descuento en USD'}
          />
        </div>

        {num > 0 && totalUsd > 0 && (
          <div className={styles.preview}>
            <div className={styles.previewRow}>
              <span>Descuento aplicado</span>
              <span className={styles.previewValue}>-${previewUsd.toFixed(2)}</span>
            </div>
            <div className={styles.previewRow}>
              <span>Equivale a</span>
              <span className={styles.previewPct}>{pct.toFixed(1)}% del subtotal</span>
            </div>
            <div className={styles.previewRow}>
              <span>Total resultante</span>
              <span className={styles.previewTotal}>${(totalUsd - previewUsd).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
