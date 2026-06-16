'use client'

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import mStyles from './modals.module.css'
import styles from './ProductModal.module.css'

/* ── Exported types ── */

export interface ProductFormData {
  name: string
  barcode: string
  saleMode: 'unit' | 'weight' | 'service'
  categoryId: number | null
  costPerUnitUsd: number
  pricePerUnitUsd: number
  stockInitial: number
}

export interface ModalCategory {
  id: number
  name: string
  color: string
}

export interface EditableProduct {
  id: number
  name: string
  barcode: string | null
  sale_mode: 'unit' | 'weight' | 'service'
  category_id: number | null
  cost_per_unit_usd: number | null
  price_per_unit_usd: number
}

interface ProductModalProps {
  isOpen: boolean
  editProduct?: EditableProduct | null
  categories: ModalCategory[]
  onClose: () => void
  onSave: (data: ProductFormData) => Promise<void>
  onNewCategory: () => void
}

/* ── Constants ── */

const SALE_MODES: Array<{ key: 'unit' | 'weight' | 'service'; label: string }> = [
  { key: 'unit',    label: 'Unidad'   },
  { key: 'weight',  label: 'Kg'       },
  { key: 'service', label: 'Servicio' },
]

/* ── Component ── */

export function ProductModal({
  isOpen,
  editProduct,
  categories,
  onClose,
  onSave,
  onNewCategory,
}: ProductModalProps) {
  const isEdit = !!editProduct

  /* ── Form state ── */
  const [name, setName]           = useState('')
  const [barcode, setBarcode]     = useState('')
  const [saleMode, setSaleMode]   = useState<'unit' | 'weight' | 'service'>('unit')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [costMode, setCostMode]   = useState<'unit' | 'bulk'>('unit')
  const [bulkSize, setBulkSize]   = useState('12')
  const [cost, setCost]           = useState('')
  const [isFixedPrice, setIsFixedPrice] = useState(false)
  const [margin, setMargin]       = useState('30')
  const [price, setPrice]         = useState('')
  const [stockInitial, setStockInitial] = useState('0')
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [isSaving, setIsSaving]   = useState(false)

  /* ── Initialize / reset ── */
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setBarcode('')
      setSaleMode('unit')
      setCategoryId(null)
      setCostMode('unit')
      setBulkSize('12')
      setCost('')
      setIsFixedPrice(false)
      setMargin('30')
      setPrice('')
      setStockInitial('0')
      setErrors({})
      setIsSaving(false)
      return
    }

    if (editProduct) {
      setName(editProduct.name)
      setBarcode(editProduct.barcode ?? '')
      setSaleMode(editProduct.sale_mode)
      setCategoryId(editProduct.category_id)
      const c = editProduct.cost_per_unit_usd ?? 0
      const p = editProduct.price_per_unit_usd
      if (c > 0) setCost(c.toFixed(2))
      setPrice(p.toFixed(2))
      if (c > 0 && p > 0) {
        const m = ((p - c) / p) * 100
        setMargin(Math.max(0, m).toFixed(1))
      }
    }
  }, [isOpen, editProduct])

  /* ── Real-time price calculation ── */
  const computed = useMemo(() => {
    const costNum     = parseFloat(cost) || 0
    const bulkNum     = Math.max(parseInt(bulkSize) || 1, 1)
    const costPerUnit = costMode === 'bulk' ? costNum / bulkNum : costNum

    const marginNum       = Math.min(Math.max(parseFloat(margin) || 0, 0), 99.9)
    const priceFromMargin = costPerUnit > 0 && marginNum < 100
      ? costPerUnit / (1 - marginNum / 100)
      : costPerUnit

    const fixedPriceNum  = parseFloat(price) || 0
    const displayPrice   = isFixedPrice ? fixedPriceNum : priceFromMargin
    const displayMargin  = isFixedPrice && displayPrice > 0 && costPerUnit > 0
      ? Math.max(0, ((displayPrice - costPerUnit) / displayPrice) * 100)
      : marginNum

    return {
      costPerUnit,
      displayPrice,
      displayMargin,
      utility: displayPrice - costPerUnit,
    }
  }, [cost, costMode, bulkSize, margin, price, isFixedPrice])

  /* ── Validation ── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!name.trim())
      errs.name = 'El nombre es obligatorio'

    if (!cost.trim() || parseFloat(cost) <= 0)
      errs.cost = 'Ingresa el costo'

    if (!isFixedPrice) {
      const m = parseFloat(margin)
      if (isNaN(m) || m < 0 || m >= 100)
        errs.margin = 'Margen debe estar entre 0% y 99.9%'
    } else {
      if (!price.trim() || parseFloat(price) <= 0)
        errs.price = 'Ingresa el precio de venta'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      await onSave({
        name:            name.trim(),
        barcode:         barcode.trim(),
        saleMode,
        categoryId,
        costPerUnitUsd:  computed.costPerUnit,
        pricePerUnitUsd: computed.displayPrice,
        stockInitial:    Math.max(parseInt(stockInitial) || 0, 0),
      })
    } catch {
      setErrors({ submit: 'Error al guardar. Intenta de nuevo.' })
      setIsSaving(false)
    }
  }

  const fmtUsd = (n: number) =>
    (n < 0 ? '-$' : '$') +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  /* ── Render ── */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={mStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          aria-modal="true"
          role="dialog"
          aria-label={isEdit ? `Editar ${editProduct?.name}` : 'Nuevo Producto'}
        >
          <motion.div
            className={`${mStyles.modal} ${mStyles.modalLg}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={mStyles.modalHeader}>
              <div>
                <h2 className={mStyles.modalTitle}>
                  {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                {isEdit && (
                  <p className={mStyles.modalSubtitle}>{editProduct?.name}</p>
                )}
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
            <form onSubmit={handleSubmit} noValidate>
              <div className={mStyles.modalBody}>

                {/* ── Nombre ── */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="pm-name">
                    Nombre del Producto
                    <span className={mStyles.required} aria-hidden="true">*</span>
                  </label>
                  <input
                    id="pm-name"
                    type="text"
                    className={`${mStyles.input} ${errors.name ? mStyles.inputError : ''}`}
                    placeholder="Ej: Queso Blanco Duro, Refresco 500ml..."
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) setErrors((p) => ({ ...p, name: '' }))
                    }}
                    maxLength={180}
                    autoFocus
                  />
                  {errors.name && <p className={mStyles.errorMsg}>{errors.name}</p>}
                </div>

                {/* ── Barcode + Vendido por ── */}
                <div className={styles.inlineRow2}>
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-barcode">
                      Código de Barras
                    </label>
                    <input
                      id="pm-barcode"
                      type="text"
                      className={mStyles.input}
                      placeholder="EAN-13, QR, SKU..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      maxLength={60}
                    />
                  </div>
                  <div className={mStyles.formGroup}>
                    <p className={mStyles.label}>Vendido por</p>
                    <div className={styles.pillGroup} role="radiogroup" aria-label="Modo de venta">
                      {SALE_MODES.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          role="radio"
                          aria-checked={saleMode === m.key}
                          className={`${styles.pill} ${saleMode === m.key ? styles.pillActive : ''}`}
                          onClick={() => setSaleMode(m.key)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Categoría ── */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="pm-category">
                    Categoría
                  </label>
                  <select
                    id="pm-category"
                    className={mStyles.select}
                    value={categoryId ?? ''}
                    onChange={(e) =>
                      setCategoryId(e.target.value ? parseInt(e.target.value) : null)
                    }
                  >
                    <option value="">— Sin categoría —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.newCategoryBtn}
                    onClick={onNewCategory}
                  >
                    <Plus size={12} aria-hidden="true" />
                    Nueva Categoría
                  </button>
                </div>

                <div className={mStyles.divider} />

                {/* ── Modo de costo ── */}
                <div className={mStyles.formGroup}>
                  <p className={mStyles.label}>Ingresar Costo Por</p>
                  <div className={styles.pillGroup} role="radiogroup" aria-label="Modo de costo">
                    {(['unit', 'bulk'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={costMode === m}
                        className={`${styles.pill} ${costMode === m ? styles.pillActive : ''}`}
                        onClick={() => setCostMode(m)}
                      >
                        {m === 'unit' ? 'Unidad' : 'Bulto / Caja'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Tamaño del bulto ── */}
                {costMode === 'bulk' && (
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-bulksize">
                      Unidades por bulto / caja
                    </label>
                    <input
                      id="pm-bulksize"
                      type="number"
                      className={mStyles.input}
                      placeholder="12"
                      value={bulkSize}
                      onChange={(e) => setBulkSize(e.target.value)}
                      min="1"
                      step="1"
                    />
                    {computed.costPerUnit > 0 && (
                      <p className={styles.bulkHint}>
                        Costo unitario equivalente:{' '}
                        <strong>{fmtUsd(computed.costPerUnit)}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* ── Costo ── */}
                <div className={mStyles.formGroup}>
                  <label className={mStyles.label} htmlFor="pm-cost">
                    Costo {costMode === 'bulk' ? 'por Bulto / Caja' : 'Unitario'} ($)
                    <span className={mStyles.required} aria-hidden="true">*</span>
                  </label>
                  <div className={`${styles.inputPrefix} ${errors.cost ? mStyles.inputError : ''}`}>
                    <span className={styles.prefixSymbol}>$</span>
                    <input
                      id="pm-cost"
                      type="number"
                      className={styles.prefixInput}
                      placeholder="0.00"
                      value={cost}
                      onChange={(e) => {
                        setCost(e.target.value)
                        if (errors.cost) setErrors((p) => ({ ...p, cost: '' }))
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {errors.cost && <p className={mStyles.errorMsg}>{errors.cost}</p>}
                </div>

                <div className={mStyles.divider} />

                {/* ── Toggle precio fijo ── */}
                <div className={styles.fixedPriceRow}>
                  <div className={styles.fixedPriceLabel}>
                    <span className={styles.fixedPriceTitle}>
                      Usar Precios Fijos (Manuales)
                    </span>
                    <span className={styles.fixedPriceSub}>
                      {isFixedPrice
                        ? 'Precio editable — margen se calcula automáticamente.'
                        : 'Precio calculado según el margen ingresado.'}
                    </span>
                  </div>
                  <label className={styles.toggle} aria-label="Activar precio fijo">
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={isFixedPrice}
                      onChange={(e) => {
                        const on = e.target.checked
                        setIsFixedPrice(on)
                        if (on && computed.displayPrice > 0) {
                          setPrice(computed.displayPrice.toFixed(2))
                        }
                      }}
                    />
                    <span className={styles.toggleTrack} />
                    <span className={styles.toggleThumb} />
                  </label>
                </div>

                {/* ── Margen + Precio ── */}
                <div className={styles.inlineRow2}>
                  {/* Margen */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-margin">
                      Margen (%)
                    </label>
                    <div
                      className={`${styles.inputPrefix} ${isFixedPrice ? styles.inputPrefixCalculated : ''}`}
                    >
                      <span className={styles.prefixSymbol}>%</span>
                      <input
                        id="pm-margin"
                        type="number"
                        className={`${styles.prefixInput} ${isFixedPrice ? styles.calculatedField : ''}`}
                        placeholder="30"
                        value={
                          isFixedPrice
                            ? computed.displayMargin.toFixed(1)
                            : margin
                        }
                        onChange={(e) => {
                          if (!isFixedPrice) {
                            setMargin(e.target.value)
                            if (errors.margin) setErrors((p) => ({ ...p, margin: '' }))
                          }
                        }}
                        readOnly={isFixedPrice}
                        tabIndex={isFixedPrice ? -1 : 0}
                        min="0"
                        max="99.9"
                        step="0.1"
                      />
                    </div>
                    {errors.margin && <p className={mStyles.errorMsg}>{errors.margin}</p>}
                  </div>

                  {/* Precio venta */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-price">
                      Precio Venta ($)
                    </label>
                    <div
                      className={`${styles.inputPrefix} ${!isFixedPrice ? styles.inputPrefixCalculated : ''}`}
                    >
                      <span className={styles.prefixSymbol}>$</span>
                      <input
                        id="pm-price"
                        type="number"
                        className={`${styles.prefixInput} ${!isFixedPrice ? styles.calculatedField : ''}`}
                        placeholder="0.00"
                        value={
                          isFixedPrice
                            ? price
                            : computed.displayPrice > 0
                              ? computed.displayPrice.toFixed(2)
                              : ''
                        }
                        onChange={(e) => {
                          if (isFixedPrice) {
                            setPrice(e.target.value)
                            if (errors.price) setErrors((p) => ({ ...p, price: '' }))
                          }
                        }}
                        readOnly={!isFixedPrice}
                        tabIndex={!isFixedPrice ? -1 : 0}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {errors.price && <p className={mStyles.errorMsg}>{errors.price}</p>}
                  </div>
                </div>

                {/* ── Utilidad estimada ── */}
                <div
                  className={`${styles.utilityCard} ${computed.utility < 0 ? styles.utilityCardNegative : ''}`}
                >
                  <div className={styles.utilityInfo}>
                    <span
                      className={`${styles.utilityLabel} ${computed.utility < 0 ? styles.utilityLabelNegative : ''}`}
                    >
                      Utilidad estimada
                    </span>
                    <span className={styles.utilitySub}>por unidad</span>
                  </div>
                  <span
                    className={`${styles.utilityAmount} ${computed.utility < 0 ? styles.utilityAmountNegative : ''}`}
                  >
                    {fmtUsd(computed.utility)}
                  </span>
                </div>

                {/* ── Stock inicial (solo creación) ── */}
                {!isEdit && saleMode !== 'service' && (
                  <>
                    <div className={mStyles.divider} />
                    <div className={mStyles.formGroup}>
                      <label className={mStyles.label} htmlFor="pm-stock">
                        Stock Inicial
                      </label>
                      <input
                        id="pm-stock"
                        type="number"
                        className={mStyles.input}
                        placeholder="0"
                        value={stockInitial}
                        onChange={(e) => setStockInitial(e.target.value)}
                        min="0"
                        step={saleMode === 'weight' ? '0.001' : '1'}
                      />
                    </div>
                  </>
                )}

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
                  disabled={isSaving}
                >
                  {isSaving && <span className={mStyles.spinner} aria-hidden="true" />}
                  {isSaving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
