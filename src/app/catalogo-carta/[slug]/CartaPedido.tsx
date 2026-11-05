'use client'

import { CartaCarrito } from './CartaCarrito'
import { CartaFab } from './CartaFab'
import type { CartaDish, CartaPayOption } from '@/types/carta'

interface CartaPedidoProps {
  slug:       string
  rate:       number
  payOptions: CartaPayOption[]
  businessName: string
  whatsapp:   string | null
  acepta:     boolean
  dishes:     CartaDish[]
}

/** Barra fija del pedido + hoja del carrito: se monta en la carta y en la ficha. */
export function CartaPedido({ slug, rate, payOptions, businessName, whatsapp, acepta, dishes }: CartaPedidoProps) {
  return (
    <>
      <CartaFab rate={rate} />
      <CartaCarrito slug={slug} rate={rate} payOptions={payOptions} businessName={businessName} whatsapp={whatsapp} acepta={acepta} dishes={dishes} />
    </>
  )
}
