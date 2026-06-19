export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'

export function computeAvailability(product: {
  product_type:  string
  availability:  string
  net_stock?:    number | null
  min_stock?:    number | null
}): Availability {
  if (product.availability === 'discontinued') return 'discontinued'
  if (product.product_type === 'service')      return 'in_stock'
  const net = product.net_stock ?? 0
  const min = product.min_stock ?? 0
  if (net <= 0)   return 'out_of_stock'
  if (net <= min) return 'low_stock'
  return 'in_stock'
}

export const CATALOG_WHERE_FILTER = {
  catalog_visibility: { not: 'hidden' as const },
} as const
