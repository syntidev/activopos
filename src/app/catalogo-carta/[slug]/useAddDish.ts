'use client'

import { useRouter } from 'next/navigation'
import { useCart } from '@/app/catalogo-premium/[slug]/CartContext'
import { dishHref } from './util'
import type { CartaDish, CartaSize } from '@/types/carta'

interface AddOptions {
  size?: CartaSize | null
  qty?:  number
  note?: string
}

/** Un solo camino para agregar un plato al pedido (hero, lista, "De la casa" y ficha). */
export function useAddDish(slug: string) {
  const router = useRouter()
  const { addToCart } = useCart()

  const add = (dish: CartaDish, opts: AddOptions = {}): void => {
    const size = opts.size ?? null
    const note = opts.note?.trim()
    addToCart({
      product_id:    dish.id,
      name:          dish.name,
      qty:           opts.qty ?? 1,
      price_usd:     size ? size.priceUsd : dish.priceUsd,
      image_url:     dish.image,
      variant_id:    size?.id,
      variant_label: size?.label,
      ...(note ? { note } : {}),
    })
  }

  /** Con tamaños hay que elegir: abre la ficha y devuelve false. Sin tamaños agrega 1 y devuelve true. */
  const quickAdd = (dish: CartaDish): boolean => {
    if (dish.sizes.length > 0) {
      router.push(dishHref(slug, dish.id))
      return false
    }
    add(dish)
    return true
  }

  return { add, quickAdd }
}
