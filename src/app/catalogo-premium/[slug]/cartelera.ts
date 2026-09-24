import { prisma } from '@/lib/prisma'

/** Tiles de la cartelera: 1 grande (2×2) + 4 normales (1×1). */
export const CARTELERA_SIZE = 5

export interface CarteleraProduct {
  id:           number
  name:         string
  image:        string | null
  categoryName: string | null
  /** Etiqueta del producto ("nuevo", etc.); null si no tiene o es "none". */
  badge:        string | null
  priceUsd:     number
  priceBs:      number | null
}

export interface CarteleraData {
  collectionName: string
  products:       CarteleraProduct[]
}

function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null
  } catch {
    return null
  }
}

/**
 * Cartelera del momento: la Collection marcada `is_cartelera_activa` del negocio
 * y sus primeros CARTELERA_SIZE productos (orden = Product.sort_order, luego id).
 * Devuelve null si no hay cartelera activa o si la campaña no tiene 5 productos
 * visibles: un grid 1+4 incompleto queda con huecos, así que el llamador cae al
 * bloque anterior en vez de pintar algo roto.
 */
export async function getCartelera(businessId: number, rate: number): Promise<CarteleraData | null> {
  const collection = await prisma.collection.findFirst({
    where:  { business_id: businessId, active: true, is_cartelera_activa: true },
    select: {
      name: true,
      products: {
        select: {
          product: {
            select: {
              id: true, name: true, images: true, badge: true, sort_order: true,
              price_per_unit_usd: true, price_per_kg_usd: true,
              active: true, catalog_visibility: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  })
  if (!collection) return null

  const products = collection.products
    .map(pc => pc.product)
    .filter(p => p.active && p.catalog_visibility !== 'hidden')
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .slice(0, CARTELERA_SIZE)
    .map((p): CarteleraProduct => {
      const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
      return {
        id:           p.id,
        name:         p.name,
        image:        firstImage(p.images),
        categoryName: p.category?.name ?? null,
        badge:        p.badge && p.badge !== 'none' ? p.badge : null,
        priceUsd,
        priceBs:      priceUsd > 0 ? priceUsd * rate : null,
      }
    })

  if (products.length < CARTELERA_SIZE) return null
  return { collectionName: collection.name, products }
}
