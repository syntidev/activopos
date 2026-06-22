'use client'

import { useState, useEffect } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Calendar } from 'lucide-react'
import styles from './CreditoModal.module.css'

export interface CreditTerms {
  credit_days: number
  due_date: Date
  credit_notes: string
}

interface CreditoModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (terms: CreditTerms) => void
  totalUsd: number
}

const PRESETS = [7, 14, 21, 30]

function formatDue(d: Date): string {
  return d.toLocaleDateString('es-VE', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })
}

export function CreditoModal({ open, onClose, onConfirm }: CreditoModalProps) {
  useScrollLock(open)

  const [days, setDays]           = useState(7)
  const [customDays, setCustomDays] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [notes, setNotes]         = useState('')

  useEffect(() => {
    if (open) {
      setDays(7); setCustomDays(''); setUseCustom(false); setNotes('')
    }
  }, [open])

  const activeDays = useCustom ? (parseInt(customDays) || 0) : days
  const dueDate    = new Date()
  dueDate.setDate(dueDate.getDate() + activeDays)

  const handleConfirm = () => {
    if (activeDays <= 0) return
    onConfirm({ credit_days: activeDays, due_date: dueDate, credit_notes: notes.trim() })
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
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          role="dialog"
          aria-modal="true"
          aria-label="Condiciones de crédito"
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <Calendar size={18} className={styles.headerIcon} aria-hidden="true" />
                <h2 className={styles.title}>Condiciones de crédito</h2>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.body}>
              <p className={styles.fieldLabel}>Plazo de pago</p>

              <div className={styles.presets}>
                {PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${styles.presetBtn} ${!useCustom && days === d ? styles.presetActive : ''}`}
                    onClick={() => { setDays(d); setUseCustom(false) }}
                  >
                    {d} días
                  </button>
                ))}
              </div>

              <div className={styles.customRow}>
                <span className={styles.customLabel}>O ingresa:</span>
                <input
                  type="number"
                  className={styles.customInput}
                  placeholder="0"
                  value={customDays}
                  onChange={(e) => { setCustomDays(e.target.value); setUseCustom(true) }}
                  min="1"
                  max="365"
                  aria-label="Días personalizados"
                />
                <span className={styles.customLabel}>días</span>
              </div>

              {activeDays > 0 && (
                <div className={styles.dueDate}>
                  <span className={styles.dueDateLabel}>Vence el</span>
                  <span className={styles.dueDateValue}>{formatDue(dueDate)}</span>
                </div>
              )}

              <div className={styles.notesField}>
                <label className={styles.fieldLabel} htmlFor="cm-credit-notes">
                  Notas (opcional)
                </label>
                <input
                  id="cm-credit-notes"
                  type="text"
                  className={styles.notesInput}
                  placeholder="Condiciones acordadas, abono inicial…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirm}
                disabled={activeDays <= 0}
              >
                Confirmar crédito
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
