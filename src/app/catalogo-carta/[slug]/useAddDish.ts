'use client'

import { useCatalogHref } from '@/components/catalog/CatalogLinks'
import { useRouter } from 'next/navigation'
import { useCart, type CartLineOption } from '@/app/catalogo-premium/[slug]/CartContext'
import { needsFicha } from './util'
import type { CartaDish, CartaSize } from '@/types/carta'

interface AddOptions {
  size?:    CartaSize | null
  qty?:     number
  note?:    string
  options?: CartLineOption[]
}

/** Un solo camino para agregar un plato al pedido (hero, lista, "De la casa", relacionados y ficha). */
export function useAddDish(slug: string) {
  const toHref = useCatalogHref(slug, 'carta')
  const router = useRouter()
  const { addToCart } = useCart()

  const add = (dish: CartaDish, opts: AddOptions = {}): void => {
    const size = opts.size ?? null
    const note = opts.note?.trim()
    const options = opts.options ?? []
    const extra = options.reduce((s, o) => s + o.price_usd, 0)
    addToCart({
      product_id:    dish.id,
      name:          dish.name,
      qty:           opts.qty ?? 1,
      price_usd:     Math.round(((size ? size.priceUsd : dish.priceUsd) + extra) * 100) / 100,
      image_url:     dish.image,
      variant_id:    size?.id,
      variant_label: size?.label,
      ...(note ? { note } : {}),
      ...(options.length > 0 ? { options } : {}),
    })
  }

  /** Con tamaños u opciones obligatorias hay que elegir: abre la ficha y devuelve false. Si no, agrega 1 y devuelve true. */
  const quickAdd = (dish: CartaDish): boolean => {
    if (dish.onRequest || dish.soldOutToday || dish.outOfStock) return false
    if (needsFicha(dish)) {
      router.push(toHref(`/p/${dish.id}`))
      return false
    }
    add(dish)
    return true
  }

  return { add, quickAdd }
}
