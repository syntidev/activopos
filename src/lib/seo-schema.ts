import { prisma } from '@/lib/prisma'
import { CATALOG_WHERE_FILTER, isOutOfStock } from '@/lib/catalog'
import { normalizePhone, isValidWaPhone } from '@/lib/whatsapp-message'
import { publicUrl } from '@/lib/og/metadata'
import { siteOrigin } from '@/lib/og/site-url'
import { loadIdentityBusiness } from '@/lib/web-identity'
import { readSeo } from '@/lib/seo'

/**
 * Schema.org JSON-LD de los catálogos públicos (adaptado de buildSchema de SYNTIweb). Portada: Store (premium/genérico) o
 * CafeOrCoffeeShop (carta). Ficha: Product con su oferta y disponibilidad según el stock REAL. Nada inventado: los campos
 * vacíos se omiten. El texto de los negocios nunca se inserta sin pasar por serializeJsonLd.
 */

type Json = string | number | boolean | null | undefined | Json[] | { [k: string]: Json }

/** Quita null/undefined/''/[]/{} de forma recursiva. */
function clean(v: Json): Json {
  if (Array.isArray(v)) {
    const items = v.map(clean).filter(x => x !== undefined)
    return items.length ? items : undefined
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).map(([k, x]) => [k, clean(x)] as const).filter(([, x]) => x !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return v === null || v === '' ? undefined : v
}

const BS = String.fromCharCode(92) // barra invertida: sin secuencias de escape literales en el código
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)

/** JSON dentro de <script>: "<" escapado ("</script>" en un nombre no puede cerrar la etiqueta); también U+2028/2029. */
export const serializeJsonLd = (data: object): string =>
  JSON.stringify(data).replace(/</g, `${BS}u003c`).split(LS).join(`${BS}u2028`).split(PS).join(`${BS}u2029`)

const absolute = (src: string | null | undefined): string | undefined => {
  if (!src) return undefined
  if (src.startsWith('/') && !src.startsWith('//')) return `${siteOrigin()}${src}`
  return src.startsWith('https://') ? src : undefined
}

const IG_RE = /^[A-Za-z0-9._]{1,30}$/

export async function storeJsonLd(slug: string): Promise<object | null> {
  const b = await loadIdentityBusiness(slug)
  if (!b) return null
  const carta = b.catalog_template === 'carta'
  const ig = b.catalog_instagram?.trim().replace(/^@/, '') ?? ''
  const wa = isValidWaPhone(b.phone) ? `https://wa.me/${normalizePhone(b.phone ?? '')}` : undefined
  const data = clean({
    '@context': 'https://schema.org',
    '@type': carta ? 'CafeOrCoffeeShop' : 'Store',
    name: b.name,
    url: publicUrl(`/c/${slug}`),
    description: readSeo(b.settings).seo_description ?? b.catalog_desc?.trim(),
    logo: absolute(b.logo_path),
    image: absolute(b.logo_path),
    telephone: b.phone?.trim(),
    address: { '@type': 'PostalAddress', streetAddress: b.address?.trim(), addressLocality: b.city?.trim(), addressRegion: b.state?.trim(), addressCountry: 'VE' },
    sameAs: IG_RE.test(ig) ? [`https://instagram.com/${ig}`] : undefined,
    potentialAction: wa ? { '@type': carta ? 'OrderAction' : 'CommunicateAction', target: wa } : undefined,
  })
  return (data as object | undefined) ?? null
}

function firstImage(raw: string | null): string | undefined {
  try {
    const list = JSON.parse(raw ?? '[]') as unknown
    return Array.isArray(list) && typeof list[0] === 'string' ? absolute(list[0]) : undefined
  } catch {
    return undefined
  }
}

export async function productJsonLd(slug: string, productId: number): Promise<object | null> {
  const b = await loadIdentityBusiness(slug)
  if (!b || !Number.isInteger(productId)) return null
  const p = await prisma.product.findFirst({
    where: { id: productId, business_id: b.id, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER },
    select: {
      name: true, description: true, images: true, sku: true, price_per_unit_usd: true, sale_mode: true, has_variants: true, availability: true,
      brand:    { select: { name: true } },
      variants: { where: { is_active: true }, select: { stock: true } },
    },
  })
  if (!p) return null
  const stock = await prisma.inventoryEntry.aggregate({ where: { business_id: b.id, product_id: productId }, _sum: { quantity: true, waste: true } })
  const out = isOutOfStock({
    sale_mode: p.sale_mode, has_variants: p.has_variants, variants: p.variants,
    net_stock: Number(stock._sum.quantity ?? 0) - Number(stock._sum.waste ?? 0),
  })
  const price = p.price_per_unit_usd === null ? null : Number(p.price_per_unit_usd)
  const url = publicUrl(`/c/${slug}/p/${productId}`)
  const data = clean({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description?.trim(),
    image: firstImage(p.images),
    sku: p.sku?.trim(),
    brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
    url,
    offers: price !== null && price > 0 ? {
      '@type': 'Offer', url, price: price.toFixed(2), priceCurrency: 'USD',
      availability: p.availability === 'discontinued' ? 'https://schema.org/Discontinued' : out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    } : undefined,
  })
  return (data as object | undefined) ?? null
}
