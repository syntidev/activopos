'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface CartItem {
  product_id:     number
  name:           string
  qty:            number
  price_usd:      number
  image_url:      string | null
  variant_id?:    number
  variant_label?: string
}

interface CartContextValue {
  cart:            CartItem[]
  totalItems:      number
  subtotalUsd:     number
  cartOpen:        boolean
  setCartOpen:     (open: boolean) => void
  checkoutOpen:    boolean
  setCheckoutOpen: (open: boolean) => void
  cartBumping:     boolean
  addToCart:       (item: CartItem) => void
  updateCartQty:   (productId: number, variantId: number | undefined, delta: number) => void
  clearCart:       () => void
}

const CartContext = createContext<CartContextValue | null>(null)

interface Props {
  slug:     string
  children: ReactNode
}

// Vive en un layout compartido de catalogo/[slug]/ — así el carrito sobrevive
// a la navegación entre home, /productos y /p/[id] (cada una desmonta el
// componente de página anterior). Persistido en localStorage por slug para
// que además sobreviva un refresh de página.
export function CartProvider({ slug, children }: Props) {
  const storageKey = `activopos_cart_${slug}`
  // Solo salta la escritura del PRIMER commit (cart=[] antes de hidratar) —
  // si en cambio se guardaba con un flag seteado por el propio efecto de
  // hidratación, ambos efectos corrían en el mismo commit y el de guardado
  // veía el flag ya en true pero el `cart` todavía viejo (closure previo a
  // que el setCart de la hidratación re-renderizara), pisando localStorage
  // con [] justo después de leer el carrito real.
  const skipNextPersist = useRef(true)

  const [cart,         setCart]         = useState<CartItem[]>([])
  const [cartOpen,     setCartOpen]     = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartBumping,  setCartBumping]  = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCart(JSON.parse(raw) as CartItem[])
    } catch {
      // localStorage corrupto/inaccesible -> arranca con carrito vacío
    }
  }, [storageKey])

  useEffect(() => {
    if (skipNextPersist.current) { skipNextPersist.current = false; return }
    localStorage.setItem(storageKey, JSON.stringify(cart))
  }, [cart, storageKey])

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === item.product_id && i.variant_id === item.variant_id)
      if (existing) {
        return prev.map(i =>
          (i.product_id === item.product_id && i.variant_id === item.variant_id)
            ? { ...i, qty: i.qty + item.qty }
            : i,
        )
      }
      return [...prev, item]
    })
    setCartBumping(true)
    setTimeout(() => setCartBumping(false), 300)
  }

  const updateCartQty = (productId: number, variantId: number | undefined, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId && i.variant_id === variantId)
      if (!item) return prev
      const newQty = item.qty + delta
      if (newQty <= 0) return prev.filter(i => !(i.product_id === productId && i.variant_id === variantId))
      return prev.map(i => (i.product_id === productId && i.variant_id === variantId) ? { ...i, qty: newQty } : i)
    })
  }

  const clearCart = () => setCart([])

  const totalItems  = cart.reduce((acc, i) => acc + i.qty, 0)
  const subtotalUsd = cart.reduce((acc, i) => acc + i.qty * i.price_usd, 0)

  return (
    <CartContext.Provider value={{
      cart, totalItems, subtotalUsd,
      cartOpen, setCartOpen,
      checkoutOpen, setCheckoutOpen,
      cartBumping,
      addToCart, updateCartQty, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
