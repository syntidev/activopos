'use client'

import { useEffect, useState } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import styles from './VariantSelector.module.css'

export interface ProductVariant {
  id: number
  name: string
  price_extra_usd: number
  price_usd: number | null
  stock: number
}

interface VariantSelectorProps {
  open: boolean
  onClose: () => void
  product: { id: number; name: string; price_per_unit_usd?: number | null } | null
  onSelect: (variant: ProductVariant) => void
}

interface ApiVariant {
  id: number
  valor: string
  precio_extra: number
  price_usd: number | null
  stock: number
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
  onSelect,
}: VariantSelectorProps) {
  useScrollLock(open)

  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !product) return
    setVariants([])
    setLoading(true)
    fetch(`/api/products/${product.id}/variants`)
      .then((r) => r.json())
      .then((j: { variants?: ApiVariant[] }) => {
        const mapped: ProductVariant[] = (j.variants ?? []).map((v) => ({
          id:              v.id,
          name:            v.valor,
          price_extra_usd: Number(v.precio_extra ?? 0),
          price_usd:       v.price_usd != null ? Number(v.price_usd) : null,
          stock:           Number(v.stock ?? 0),
        }))
        setVariants(mapped)
      })
      .catch(() => setVariants([]))
      .finally(() => setLoading(false))
  }, [open, product])

  const basePrice = product?.price_per_unit_usd ?? 0

  const getPrice = (v: ProductVariant): number =>
    v.price_usd != null ? v.price_usd : basePrice + v.price_extra_usd

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
              ) : (
                <div className={styles.variantGrid}>
                  {variants.map((v) => {
                    const price = getPrice(v)
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
                        <span className={styles.variantName}>{v.name}</span>
                        <span className={styles.variantPrice}>${price.toFixed(2)}</span>
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
