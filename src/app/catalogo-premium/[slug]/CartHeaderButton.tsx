'use client'

import { ShoppingBag } from 'lucide-react'
import { useCart } from './CartContext'
import styles from './catalogo.module.css'

// Ícono + badge del carrito — compartido entre CatalogoGrid (home/productos)
// y ProductoDetalle (/p/[id]) para que las 3 rutas muestren el mismo estado.
export function CartHeaderButton() {
  const { totalItems, cartBumping, setCartOpen } = useCart()

  return (
    <button
      type="button"
      className={`${styles.stickyCartBtn} ${totalItems === 0 ? styles.cartIdleAnimation : ''}`}
      onClick={() => setCartOpen(true)}
      aria-label={`Carrito — ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`}
    >
      <ShoppingBag size={20} aria-hidden="true" className={cartBumping ? styles.cartBump : ''} />
      {totalItems > 0 && (
        <span className={`${styles.cartCount} ${cartBumping ? styles.cartBadgeBump : ''}`} aria-hidden="true">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  )
}
