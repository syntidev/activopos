'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { track } from '@/lib/pulso-client'

export interface CartItem {
  product_id:     number
  name:           string
  qty:            number
  price_usd:      number
  image_url:      string | null
  variant_id?:    number
  variant_label?: string
  /** Nota para la cocina de la Carta (opcional); dos notas distintas del mismo plato son líneas distintas. */
  note?:          string
}

/** Identidad de línea: producto + variante + nota (sin nota = undefined o vacío). */
function sameLine(i: CartItem, productId: number, variantId: number | undefined, note: string | undefined): boolean {
  return i.product_id === productId && i.variant_id === variantId && (i.note ?? '') === (note ?? '')
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
  updateCartQty:   (productId: number, variantId: number | undefined, delta: number, note?: string) => void
  removeFromCart:  (productId: number, variantId: number | undefined, note?: string) => void
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

  // Una vez por cada apertura del checkout.
  useEffect(() => { if (checkoutOpen) track({ type: 'checkout_start' }) }, [checkoutOpen])

  const addToCart = (item: CartItem) => {
    track({ type: 'add_to_cart', product_id: item.product_id })
    setCart(prev => {
      const existing = prev.find(i => sameLine(i, item.product_id, item.variant_id, item.note))
      if (existing) {
        return prev.map(i => sameLine(i, item.product_id, item.variant_id, item.note) ? { ...i, qty: i.qty + item.qty } : i)
      }
      return [...prev, item]
    })
    setCartBumping(true)
    setTimeout(() => setCartBumping(false), 300)
  }

  const updateCartQty = (productId: number, variantId: number | undefined, delta: number, note?: string) => {
    setCart(prev => {
      const item = prev.find(i => sameLine(i, productId, variantId, note))
      if (!item) return prev
      const newQty = item.qty + delta
      if (newQty <= 0) return prev.filter(i => !sameLine(i, productId, variantId, note))
      return prev.map(i => sameLine(i, productId, variantId, note) ? { ...i, qty: newQty } : i)
    })
  }

  const removeFromCart = (productId: number, variantId: number | undefined, note?: string) => {
    setCart(prev => prev.filter(i => !sameLine(i, productId, variantId, note)))
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
      addToCart, updateCartQty, removeFromCart, clearCart,
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
