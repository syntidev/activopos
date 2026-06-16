'use client'

import { motion } from 'framer-motion'
import { Badge } from '@/components/ui'
import type { ProductForPOS } from '@/lib/pos'
import styles from './ProductCard.module.css'

interface ProductCardProps {
  product: ProductForPOS
  rate: number
  onAdd: (p: ProductForPOS) => void
}

export function ProductCard({ product, rate, onAdd }: ProductCardProps) {
  const price =
    product.sale_mode === 'weight'
      ? (product.price_per_kg_usd ?? 0)
      : (product.price_per_unit_usd ?? 0)

  const stock = product.stock?.net_qty ?? 0
  const stockVariant = stock <= 0 ? 'danger' : stock <= 5 ? 'warning' : 'success'
  const stockLabel = stock <= 0 ? 'Sin stock' : stock <= 5 ? `${stock} quedan` : `${stock}`

  const initial = product.name.charAt(0).toUpperCase()
  const unitSuffix = product.sale_mode === 'weight' ? '/kg' : `/${product.base_unit_label}`

  return (
    <motion.button
      className={styles.card}
      onClick={() => onAdd(product)}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      aria-label={`Agregar ${product.name}`}
      type="button"
      disabled={stock <= 0}
    >
      <div className={styles.imageArea}>
        {product.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_path} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">{initial}</div>
        )}
        <div className={styles.stockBadge}>
          <Badge variant={stockVariant} size="sm">{stockLabel}</Badge>
        </div>
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{product.name}</span>
        <span className={styles.unit}>{product.base_unit_label}</span>
        <div className={styles.prices}>
          <span className={styles.priceUsd}>
            ${price.toFixed(2)}<span className={styles.priceUnit}>{unitSuffix}</span>
          </span>
          <span className={styles.priceBs}>
            Bs.&nbsp;{(price * rate).toFixed(2)}
          </span>
        </div>
      </div>
    </motion.button>
  )
}
