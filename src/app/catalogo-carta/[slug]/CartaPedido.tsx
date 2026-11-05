'use client'

import { CartaCarrito } from './CartaCarrito'
import { CartaFab } from './CartaFab'
import type { CartaPayOption } from '@/types/carta'

interface CartaPedidoProps {
  slug:       string
  rate:       number
  payOptions: CartaPayOption[]
}

/** Barra fija del pedido + hoja del carrito: se monta en la carta y en la ficha. */
export function CartaPedido({ slug, rate, payOptions }: CartaPedidoProps) {
  return (
    <>
      <CartaFab rate={rate} />
      <CartaCarrito slug={slug} rate={rate} payOptions={payOptions} />
    </>
  )
}
