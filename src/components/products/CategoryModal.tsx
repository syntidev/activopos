'use client'

import { useState, useEffect } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Tag, Check } from 'lucide-react'
import mStyles from './modals.module.css'
import styles from './CategoryModal.module.css'

interface InitialData {
  id?: number
  name: string
  color: string
  requires_preparation: boolean
}

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: InitialData
  onSave: (name: string, color: string, requiresPreparation: boolean) => Promise<void>
}

const COLORS: Array<{ key: string; label: string }> = [
  { key: 'blue',   label: 'Azul'    },
  { key: 'green',  label: 'Verde'   },
  { key: 'orange', label: 'Naranja' },
  { key: 'red',    label: 'Rojo'    },
  { key: 'violet', label: 'Violeta' },
  { key: 'pink',   label: 'Rosa'    },
  { key: 'cyan',   label: 'Cian'    },
  { key: 'gray',   label: 'Gris'    },
]

const DOT_CLASS: Record<string, string> = {
  blue:   styles.dotBlue,
  green:  styles.dotGreen,
  orange: styles.dotOrange,
  red:    styles.dotRed,
  violet: styles.dotViolet,
  pink:   styles.dotPink,
  cyan:   styles.dotCyan,
  gray:   styles.dotGray,
}

// La API (/api/categories) exige color como hex '#RRGGBB' — este picker trabaja
// con keys de paleta (dots), así que se traduce key<->hex al guardar/precargar.
const COLOR_HEX: Record<string, string> = {
  blue:   '#0038BD',
  green:  '#16A34A',
  orange: '#FBBF24',
  red:    '#EF4444',
  violet: '#7C3AED',
  pink:   '#EC4899',
  cyan:   '#0891B2',
  gray:   '#64748B',
}
const DEFAULT_COLOR_KEY = 'blue'
const HEX_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([key, hex]) => [hex, key])
)

export function CategoryModal({ isOpen, onClose, initialData, onSave }: CategoryModalProps) {
  useScrollLock(isOpen)

  const [name, setName]                   = useState('')
  const [color, setColor]                 = useState('blue')
  const [requiresPrep, setRequiresPrep]   = useState(false)
  const [error, setError]                 = useState('')
  const [isSaving, setIsSaving]           = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name ?? '')
      setColor((initialData?.color && HEX_TO_KEY[initialData.color]) || DEFAULT_COLOR_KEY)
      setRequiresPrep(initialData?.requires_preparation ?? false)
      setError('')
      setIsSaving(false)
    }
  }, [isOpen, initialData])

  const isEdit = Boolean(initialData?.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('El nombre es obligatorio')
      return
    }
    setError('')
    setIsSaving(true)
    try {
      const colorHex = COLOR_HEX[color] ?? COLOR_HEX[DEFAULT_COLOR_KEY]
      await onSave(trimmed, colorHex, requiresPrep)
      onClose()
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={mStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          aria-modal="true"
          role="dialog"
          aria-label={isEdit ? 'Editar categoría' : 'Nueva categoría'}
        >
          <motion.div
            className={`${mStyles.modal} ${mStyles.modalSm}`}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={mStyles.modalHeader}>
              <div className={styles.titleRow}>
                <Tag size={16} className={styles.titleIcon} aria-hidden="true" />
                <h2 className={mStyles.modalTitle}>
                  {isEdit ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
              </div>
              <button
                className={mStyles.closeBtn}
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className={mStyles.modalBody}>
                {/* Name */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="cat-name">
                    Nombre de la categoría
                    <span className={mStyles.required} aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    className={`${mStyles.input} ${error ? mStyles.inputError : ''}`}
                    placeholder="Ej: Bebidas, Lácteos, Snacks..."
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (error) setError('')
                    }}
                    autoFocus
                    maxLength={80}
                  />
                  {error && <p className={mStyles.errorMsg}>{error}</p>}
                </div>

                {/* Color */}
                <div className={mStyles.formGroup}>
                  <p className={mStyles.label}>Color</p>
                  <div className={styles.colorGrid} role="radiogroup" aria-label="Color de la categoría">
                    {COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        role="radio"
                        aria-checked={color === c.key}
                        aria-label={c.label}
                        title={c.label}
                        className={`${styles.dot} ${DOT_CLASS[c.key]} ${color === c.key ? styles.dotSelected : ''}`}
                        onClick={() => setColor(c.key)}
                      >
                        {color === c.key && (
                          <Check size={12} strokeWidth={3} className={styles.dotCheck} aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className={styles.preview}>
                  <span className={styles.previewLabel}>Vista previa:</span>
                  <span className={`${styles.previewBadge} ${styles[`badge_${color}`]}`}>
                    {name || 'Categoría'}
                  </span>
                </div>

                {/* Requires preparation */}
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    className={styles.checkInput}
                    checked={requiresPrep}
                    onChange={(e) => setRequiresPrep(e.target.checked)}
                  />
                  <span className={styles.checkText}>
                    <span className={styles.checkLabel}>Requiere preparación</span>
                    <span className={styles.checkHelp}>
                      Los productos de esta categoría aparecerán en la pantalla de cocina antes de ser entregados.
                    </span>
                  </span>
                </label>
              </div>

              {/* Footer */}
              <div className={mStyles.modalFooter}>
                <button
                  type="button"
                  className={mStyles.btnSecondary}
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={mStyles.btnPrimary}
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving && <span className={mStyles.spinner} aria-hidden="true" />}
                  {isSaving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
