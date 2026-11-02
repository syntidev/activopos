'use client'

import { useEffect, useState } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { priceForMode, variantBases, type PriceMode, type PriceSource, type PricingProduct } from '@/lib/pricing'
import styles from './VariantSelector.module.css'

export interface ProductVariant {
  id: number
  name: string
  price_extra_usd: number
  price_usd: number | null
  divisa_price_usd: number | null
  stock: number
  tipo?: string
  combination_key?: string | null
  variant_group?: string | null
  sku?: string | null
}

interface VariantSelectorProps {
  open: boolean
  onClose: () => void
  /** Precios del producto: con ellos y el modo del ticket se calcula, con la misma regla del servidor, el precio de cada talla. */
  product: (PricingProduct & { id: number; name: string; sale_mode?: string }) | null
  /** Modo de precio del ticket (BCV / Divisa): el selector muestra el precio de ESE modo. */
  mode: PriceMode
  /** Tasa del ticket para mostrar el equivalente en Bs. */
  rate: number
  onSelect: (variant: ProductVariant) => void
}

interface ApiVariant {
  id: number
  valor: string
  precio_extra: number
  price_usd: number | null
  divisa_price_usd: number | null
  stock: number
  tipo: string
  combination_key: string | null
  variant_group: string | null
  sku: string | null
}

function VariantSkeleton() {
  return (
    <div className={styles.variantGrid}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonBtn}`} />
      ))}
    </div>
  )
}

export function VariantSelector({
  open,
  onClose,
  product,
  mode,
  rate,
  onSelect,
}: VariantSelectorProps) {
  useScrollLock(open)

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDim1, setSelectedDim1] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !product) return
    setVariants([])
    setSelectedDim1(null)
    setLoading(true)
    fetch(`/api/products/${product.id}/variants`)
      .then((r) => r.json())
      .then((j: { variants?: ApiVariant[] }) => {
        const mapped: ProductVariant[] = (j.variants ?? []).map((v) => ({
          id:              v.id,
          name:            v.valor,
          price_extra_usd: Number(v.precio_extra ?? 0),
          price_usd:       v.price_usd != null ? Number(v.price_usd) : null,
          divisa_price_usd: v.divisa_price_usd != null ? Number(v.divisa_price_usd) : null,
          stock:           Number(v.stock ?? 0),
          tipo:            v.tipo,
          combination_key: v.combination_key,
          variant_group:   v.variant_group,
          sku:             v.sku,
        }))
        setVariants(mapped)
      })
      .catch(() => setVariants([]))
      .finally(() => setLoading(false))
  }, [open, product])

  // Misma regla que la línea del ticket y que el servidor (lib/pricing.ts): precio del modo del ticket, o Full marcado "Sin precio Divisa".
  const getLine = (v: ProductVariant): { price: number; source: PriceSource } =>
    product
      ? priceForMode(variantBases(product, { precio_extra: v.price_extra_usd, price_usd: v.price_usd, divisa_price_usd: v.divisa_price_usd }, product.sale_mode), mode)
      : { price: 0, source: 'bcv' }

  /** USD y Bs a la vez (regla sellada) + aviso cuando se pidió Divisa y la talla no tiene precio Divisa. */
  const renderPrice = (v: ProductVariant) => {
    const { price, source } = getLine(v)
    return (
      <>
        <span className={styles.variantPrice} data-testid="variant-price" data-source={source}>${price.toFixed(2)}</span>
        <span className={styles.variantBs}>Bs. {(price * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        {source === 'fallback_bcv' && (
          <span className={styles.variantNote} title="Esta talla no tiene precio Divisa: se cobra a precio BCV">Sin precio Divisa</span>
        )}
      </>
    )
  }

  // Variantes combinadas (talla+color…): combination_key = "S-Azul", tipo = "talla+color".
  // El primer segmento (antes del primer "-") es la dimensión 1.
  // every() y no some(): con una sola variante sin combination_key, el map de
  // abajo hace .split() sobre null y tumba la vista. Mixto => se trata legacy.
  const isCombined = variants.length > 0 && variants.every(v => v.combination_key)
  const dim1Labels = isCombined ? (variants[0]?.tipo ?? '').split('+') : []
  const dim1Label  = dim1Labels[0] ?? 'Talla'
  const dim2Label  = dim1Labels[1] ?? 'Color'

  const dim1Options = isCombined
    ? Array.from(new Set(variants.map(v => v.combination_key!.split('-')[0])))
    : []

  const dim2Options = selectedDim1 !== null
    ? variants.filter(v => v.combination_key!.startsWith(`${selectedDim1}-`))
    : []

  const handleSelect = (variant: ProductVariant) => {
    if (variant.stock <= 0) return
    onSelect(variant)
    onClose()
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
          aria-label={`Seleccionar variante de ${product?.name ?? 'producto'}`}
        >
          <motion.div
            className={styles.sheet}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div>
                <p className={styles.headerLabel}>Seleccionar variante</p>
                <h2 className={styles.headerTitle}>{product?.name}</h2>
              </div>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.body}>
              {loading ? (
                <VariantSkeleton />
              ) : variants.length === 0 ? (
                <p className={styles.empty}>No hay variantes disponibles.</p>
              ) : isCombined ? (
                <div className={styles.chainedWrap}>
                  <p className={styles.chainedStepLabel}>1. {dim1Label}</p>
                  <div className={styles.chainedChips}>
                    {dim1Options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`${styles.chainedChip} ${selectedDim1 === opt ? styles.chainedChipActive : ''}`}
                        onClick={() => setSelectedDim1(opt)}
                        aria-pressed={selectedDim1 === opt}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {selectedDim1 !== null && (
                    <>
                      <p className={styles.chainedStepLabel}>2. {dim2Label}</p>
                      <div className={styles.variantGrid}>
                        {dim2Options.map((v) => {
                          const outOfStock = v.stock <= 0
                          const label = v.combination_key!.slice(selectedDim1.length + 1)
                          return (
                            <button
                              key={v.id}
                              className={`${styles.variantBtn} ${outOfStock ? styles.variantBtnOut : ''}`}
                              onClick={() => handleSelect(v)}
                              disabled={outOfStock}
                              aria-disabled={outOfStock}
                              type="button"
                            >
                              <span className={styles.variantName}>{label}</span>
                              {renderPrice(v)}
                              <span className={`${styles.variantStock} ${outOfStock ? styles.variantStockOut : ''}`}>
                                {outOfStock ? 'Agotado' : `${v.stock} und`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.variantGrid}>
                  {variants.map((v) => {
                    const outOfStock = v.stock <= 0
                    return (
                      <button
                        key={v.id}
                        className={`${styles.variantBtn} ${outOfStock ? styles.variantBtnOut : ''}`}
                        onClick={() => handleSelect(v)}
                        disabled={outOfStock}
                        aria-disabled={outOfStock}
                        type="button"
                      >
                        <span className={styles.variantName}>{v.name}{v.sku ? ` (${v.sku})` : ''}</span>
                        {renderPrice(v)}
                        <span className={`${styles.variantStock} ${outOfStock ? styles.variantStockOut : ''}`}>
                          {outOfStock ? 'Agotado' : `${v.stock} und`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
