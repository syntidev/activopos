import { prisma } from './prisma'

const MAX_MARCA_LEN = 80

/**
 * Slug de marca para la URL de la vitrina: minúsculas, sin acentos, espacios a guiones ("Garmin Edge" → "garmin-edge").
 * Todo lo que no es [a-z0-9] se vuelve guion ("A&B" → "a-b"): el slug nunca necesita codificarse en la URL.
 */
export function brandSlug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface VitrinaBrand {
  id:        number
  name:      string
  image_url: string | null
}

/**
 * Marca del negocio cuyo slug coincide con `marca`. null si no existe o está oculta (visible=false):
 * el llamador responde 404. Siempre acotada por business_id.
 */
export async function resolveVitrinaBrand(businessId: number, marca: string): Promise<VitrinaBrand | null> {
  let wanted: string
  try { wanted = decodeURIComponent(marca) } catch { return null }
  if (!wanted || wanted.length > MAX_MARCA_LEN) return null
  const brands = await prisma.brand.findMany({
    where:   { business_id: businessId, visible: true },
    select:  { id: true, name: true, image_url: true },
    orderBy: { order: 'asc' },
  })
  return brands.find(b => brandSlug(b.name) === wanted) ?? null
}
