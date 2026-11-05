import { prisma } from '@/lib/prisma'
import { CATALOG_WHERE_FILTER } from '@/lib/catalog'
import { CONFIG_SCHEMAS } from '@/lib/landing-sections'

function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null
  } catch { return null }
}

/** Imagen para compartir (og:image): primer slide del hero configurado; si no, la foto de un plato destacado o el primero con foto. */
export async function cartaOgImage(businessId: number): Promise<string | null> {
  const row = await prisma.landingSection
    .findFirst({ where: { business_id: businessId, type: 'event_slider', visible: true }, orderBy: { order: 'asc' }, select: { config: true } })
    .catch(() => null)
  const parsed = row ? CONFIG_SCHEMAS.event_slider.safeParse(row.config) : null
  if (parsed?.success) return parsed.data.slides[0].image_url
  const product = await prisma.product.findFirst({
    where:   { business_id: businessId, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER, images: { not: null } },
    orderBy: [{ is_featured: 'desc' }, { name: 'asc' }],
    select:  { images: true },
  })
  return firstImage(product?.images ?? null)
}

export interface DishMeta {
  name:        string
  description: string | null
  image:       string | null
}

/** Datos mínimos de un plato para el SEO de su ficha (sin cargar toda la carta). */
export async function cartaDishMeta(businessId: number, productId: number): Promise<DishMeta | null> {
  const p = await prisma.product.findFirst({
    where:  { id: productId, business_id: businessId, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER },
    select: { name: true, description: true, images: true },
  })
  return p ? { name: p.name, description: p.description, image: firstImage(p.images) } : null
}
