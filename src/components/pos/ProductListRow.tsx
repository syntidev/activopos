'use client'

import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { ProductForPOS } from '@/lib/pos'
import type { PriceMode } from '@/lib/pricing'
import { cardPrice, NO_DIVISA_LABEL, NO_DIVISA_TITLE } from '@/lib/pos-products'
import styles from './ProductListRow.module.css'

interface Props {
  product: ProductForPOS
  rate: number
  /** Modo de precio del ticket activo: la fila muestra el precio de ESE modo. */
  mode: PriceMode
  onAdd: (p: ProductForPOS) => void
}

export function ProductListRow({ product, rate, mode, onAdd }: Props) {
  const { price, source } = cardPrice(product, mode)

  const stock        = product.stock?.net_qty ?? 0
  const isService    = product.sale_mode === 'service'
  const outOfStock   = !isService && stock <= 0
  const stockVariant = isService ? 'success' : stock <= 0 ? 'danger' : stock <= 5 ? 'warning' : 'success'
  const stockLabel   = isService ? 'Disponible' : stock <= 0 ? 'Agotado' : stock <= 5 ? `${stock} quedan` : `${stock}`
  const unitSuffix   = product.sale_mode === 'weight' ? '/kg' : `/${product.base_unit_label}`

  return (
    <motion.div
      className={`${styles.row} ${outOfStock ? styles.rowDisabled : ''}`}
      data-testid="product-card"
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 4 }}
      transition={{ duration: 0.12 }}
    >
      <div className={styles.thumb} aria-hidden="true">
        {product.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_path} alt="" className={styles.thumbImg} />
        ) : (
          <span className={styles.thumbInitial}>
            {product.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>{product.name}</span>
        <span className={styles.unit}>{product.base_unit_label}</span>
      </div>

      <div className={styles.priceCol}>
        <span className={styles.priceUsd}>
          ${price.toFixed(2)}
          <span className={styles.priceUnit}>{unitSuffix}</span>
        </span>
        <span className={styles.priceBs}>
          Bs.&nbsp;{(price * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
        </span>
        {source === 'fallback_bcv' && <span className={styles.fallbackNote} title={NO_DIVISA_TITLE}>{NO_DIVISA_LABEL}</span>}
      </div>

      <div className={styles.stockCol}>
        <Badge variant={stockVariant} size="sm">{stockLabel}</Badge>
      </div>

      <motion.button
        type="button"
        className={styles.addBtn}
        onClick={() => !outOfStock && onAdd(product)}
        whileTap={outOfStock ? {} : { scale: 0.88 }}
        transition={{ duration: 0.08 }}
        disabled={outOfStock}
        aria-label={`Agregar ${product.name}`}
      >
        <Plus size={16} aria-hidden="true" />
      </motion.button>
    </motion.div>
  )
}
