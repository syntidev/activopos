'use client'

import { ShoppingCart } from 'lucide-react'
import styles from './MobileCartBar.module.css'

interface MobileCartBarProps {
  itemCount: number
  totalUsd: number
  totalBs: number
  cobroBlocked: boolean
  onOpen: () => void
  onCobrar: () => void
}

/** Barra inferior del POS móvil: resumen del ticket (abre la hoja) y "Cobrar". Solo se monta con el ticket no vacío. */
export function MobileCartBar({ itemCount, totalUsd, totalBs, cobroBlocked, onOpen, onCobrar }: MobileCartBarProps) {
  return (
    <div className={styles.bar} data-testid="pos-cart-bar">
      <button
        type="button"
        className={styles.summary}
        onClick={onOpen}
        aria-label={`Ver carrito (${itemCount} ítems)`}
      >
        <ShoppingCart size={20} aria-hidden="true" className={styles.icon} />
        <span className={styles.count} data-testid="pos-cart-count">
          {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
        </span>
        <span className={styles.totals}>
          <span className={styles.usd} data-testid="pos-cart-usd">${totalUsd.toFixed(2)}</span>
          <span className={styles.bs}>
            Bs.&nbsp;{totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        </span>
      </button>
      <button type="button" className={styles.cobrar} onClick={onCobrar} disabled={cobroBlocked}>
        Cobrar
      </button>
    </div>
  )
}
