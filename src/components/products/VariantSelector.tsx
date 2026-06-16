'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import styles from './VariantSelector.module.css'

export interface ProductVariant {
  id: number
  name: string
  price_extra_usd: number
  stock: number
}

interface VariantSelectorProps {
  open: boolean
  onClose: () => void
  product: { id: number; name: string } | null
  onSelect: (variant: ProductVariant) => void
}

function VariantSkeleton() {
  return (
    <div className={styles.skeletonGrid}>
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
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !product) return
    setVariants([])
    setLoading(true)
    fetch(`/api/products/${product.id}/variants`)
      .then((r) => r.json())
      .then((j) => setVariants(j.variants ?? []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false))
  }, [open, product])

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
        >
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0, 0.67, 0] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.handle} aria-hidden="true" />

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
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      className={`${styles.variantBtn} ${
                        v.stock <= 0 ? styles.variantBtnOut : ''
                      }`}
                      onClick={() => handleSelect(v)}
                      disabled={v.stock <= 0}
                      aria-disabled={v.stock <= 0}
                      type="button"
                    >
                      <span className={styles.variantName}>{v.name}</span>
                      {v.price_extra_usd > 0 && (
                        <span className={styles.variantExtra}>
                          +${v.price_extra_usd.toFixed(2)}
                        </span>
                      )}
                      {v.stock <= 0 && (
                        <span className={styles.variantStockOut}>Agotado</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
