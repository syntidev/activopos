'use client'

import { ShoppingCart } from 'lucide-react'
import styles from './MobileCartBar.module.css'

interface MobileCartBarProps {
  itemCount: number
  totalUsd: number
  totalBs: number
  cobroBlocked: boolean
  /** Tickets (pestañas) con ítems. Con el ticket activo vacío la barra solo avisa de ellos. */
  openTickets: number
  onOpen: () => void
  onCobrar: () => void
}

/** Barra inferior del POS móvil: resumen del ticket (abre la hoja) y "Cobrar". Se monta si algún ticket tiene ítems. */
export function MobileCartBar({ itemCount, totalUsd, totalBs, cobroBlocked, openTickets, onOpen, onCobrar }: MobileCartBarProps) {
  // Ticket activo vacío pero otra pestaña con ítems: sin totales ni Cobrar, solo acceso a la hoja.
  if (itemCount === 0) {
    return (
      <div className={styles.bar} data-testid="pos-cart-bar">
        <button
          type="button"
          className={styles.summary}
          onClick={onOpen}
          aria-label={`Ver tickets abiertos (${openTickets})`}
        >
          <ShoppingCart size={20} aria-hidden="true" className={styles.icon} />
          <span className={styles.openTickets} data-testid="pos-cart-open-tickets">Tickets abiertos: {openTickets}</span>
        </button>
      </div>
    )
  }

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
