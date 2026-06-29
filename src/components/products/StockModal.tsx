'use client'

import { useState, useEffect } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Package } from 'lucide-react'
import mStyles from './modals.module.css'
import styles from './StockModal.module.css'

interface StockProduct {
  id: number
  name: string
  stock_quantity: number
  sale_mode: 'unit' | 'weight' | 'service'
  cost_per_unit_usd: number | null
}

interface StockModalProps {
  isOpen: boolean
  product: StockProduct | null
  onClose: () => void
  onSave: (
    productId: number,
    type: 'entry' | 'adjust',
    quantity: number,
    costPerUnit: number | null,
    supplier: string,
    notes: string,
  ) => Promise<void>
}

export function StockModal({ isOpen, product, onClose, onSave }: StockModalProps) {
  useScrollLock(isOpen)

  const [type, setType]         = useState<'entry' | 'adjust'>('entry')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost]         = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes]       = useState('')
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setType('entry')
      setQuantity('')
      setCost('')
      setSupplier('')
      setNotes('')
      setErrors({})
      setIsSaving(false)
    } else if (product?.cost_per_unit_usd) {
      setCost(product.cost_per_unit_usd.toString())
    }
  }, [isOpen, product])

  const unit = product?.sale_mode === 'weight' ? 'kg' : 'und'

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const qty = parseFloat(quantity)

    if (!quantity.trim()) {
      newErrors.quantity = 'La cantidad es obligatoria'
    } else if (isNaN(qty) || qty <= 0) {
      newErrors.quantity = 'Ingresa una cantidad válida mayor a 0'
    } else if (product?.sale_mode === 'unit' && !Number.isInteger(qty)) {
      newErrors.quantity = 'La cantidad debe ser un número entero'
    }

    if (cost.trim() && (isNaN(parseFloat(cost)) || parseFloat(cost) < 0)) {
      newErrors.cost = 'Ingresa un costo válido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !validate()) return

    setIsSaving(true)
    try {
      await onSave(
        product.id,
        type,
        parseFloat(quantity),
        cost.trim() ? parseFloat(cost) : null,
        supplier.trim(),
        notes.trim(),
      )
      onClose()
    } catch {
      setErrors({ submit: 'Error al guardar. Intenta de nuevo.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && product && (
        <motion.div
          className={mStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          aria-modal="true"
          role="dialog"
          aria-label={`Ajustar stock: ${product.name}`}
        >
          <motion.div
            className={mStyles.modal}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={mStyles.modalHeader}>
              <div>
                <h2 className={styles.productName}>{product.name}</h2>
                <p className={styles.modalSubtitle}>Ajustar stock</p>
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
                {/* Current stock info */}
                <div className={styles.stockInfo}>
                  <Package size={16} className={styles.stockIcon} aria-hidden="true" />
                  <div>
                    <p className={styles.stockInfoLabel}>Stock actual</p>
                    <p className={styles.stockInfoValue}>
                      {product.stock_quantity} {unit}
                    </p>
                  </div>
                </div>

                {/* Type toggle */}
                <div className={mStyles.formGroup}>
                  <p className={mStyles.label}>Tipo de movimiento</p>
                  <div className={styles.typeToggle} role="radiogroup" aria-label="Tipo de movimiento">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={type === 'entry'}
                      className={`${styles.typeBtn} ${type === 'entry' ? styles.typeBtnActive : ''}`}
                      onClick={() => setType('entry')}
                    >
                      Entrada
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={type === 'adjust'}
                      className={`${styles.typeBtn} ${type === 'adjust' ? styles.typeBtnActive : ''}`}
                      onClick={() => setType('adjust')}
                    >
                      Ajuste
                    </button>
                  </div>
                  <p className={styles.typeHint}>
                    {type === 'entry'
                      ? 'Se suma al stock actual. Ideal para recepciones de mercancía.'
                      : 'Corrige el stock existente. Registra discrepancias de inventario.'}
                  </p>
                </div>

                {/* Quantity */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="stock-qty">
                    Cantidad ({unit})
                    <span className={mStyles.required} aria-hidden="true">*</span>
                  </label>
                  <input
                    id="stock-qty"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className={`${mStyles.input} ${errors.quantity ? mStyles.inputError : ''}`}
                    placeholder={product.sale_mode === 'weight' ? '0.000' : '0'}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value)
                      if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: '' }))
                    }}
                    autoFocus
                  />
                  {errors.quantity && <p className={mStyles.errorMsg}>{errors.quantity}</p>}
                </div>

                {/* Cost per unit (optional) */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="stock-cost">
                    Costo por {unit} ($) <span className={styles.optional}>(opcional)</span>
                  </label>
                  <input
                    id="stock-cost"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    className={`${mStyles.input} ${errors.cost ? mStyles.inputError : ''}`}
                    placeholder="0.00"
                    value={cost}
                    onChange={(e) => {
                      setCost(e.target.value)
                      if (errors.cost) setErrors((prev) => ({ ...prev, cost: '' }))
                    }}
                  />
                  {errors.cost && <p className={mStyles.errorMsg}>{errors.cost}</p>}
                </div>

                {/* Supplier */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="stock-supplier">
                    Proveedor <span className={styles.optional}>(opcional)</span>
                  </label>
                  <input
                    id="stock-supplier"
                    type="text"
                    className={mStyles.input}
                    placeholder="Nombre del proveedor"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    maxLength={120}
                  />
                </div>

                {/* Notes */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="stock-notes">
                    Notas <span className={styles.optional}>(opcional)</span>
                  </label>
                  <textarea
                    id="stock-notes"
                    className={mStyles.textarea}
                    placeholder="Motivo del ajuste, número de factura, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                  />
                </div>

                {errors.submit && (
                  <p className={mStyles.errorMsg}>{errors.submit}</p>
                )}
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
                  disabled={isSaving || !quantity.trim()}
                >
                  {isSaving && <span className={mStyles.spinner} aria-hidden="true" />}
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
