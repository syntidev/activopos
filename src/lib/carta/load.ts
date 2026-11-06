import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getActiveRate } from '@/lib/bcv'
import { divisaPriceOf, readDivisaMethodIds } from '@/lib/catalog-divisa'
import { CATALOG_WHERE_FILTER, isCatalogLive, isOutOfStock, tracksStock } from '@/lib/catalog'
import { chipMethods, readCobroEffective } from '@/lib/cobro-precios'
import { CONFIG_SCHEMAS } from '@/lib/landing-sections'
import { resolveUnitPriceUsd, VARIANT_PRICING_SELECT } from '@/lib/pricing'
import { isValidWaPhone, normalizePhone } from '@/lib/whatsapp-message'
import { topSellerIds } from '@/lib/carta/favoritos'
import { isSoldOutToday } from '@/lib/carta/options'
import { formatHours, isCartaPaused, openState, readCartaHours, readCartaSettings, type CartaSettings } from '@/lib/carta/settings'
import { readAllergens, readTags, type CartaTag } from '@/lib/carta/vocab'
import type {
  CartaCategory, CartaDish, CartaHero, CartaHeroSlide, CartaHorarioDia, CartaOpenState, CartaOptionGroup, CartaPagos, CartaPayOption, CartaSize,
} from '@/types/carta'

const FAVORITOS_MAX = 4
const CASA_MAX = 3

export function getCartaBusiness(slug: string) {
  return prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      id: true, name: true, logo_path: true, phone: true, whatsapp: true, city: true, address: true,
      catalog_title: true, catalog_desc: true, catalog_hours: true, catalog_template: true, catalog_plan: true,
      catalog_cover_path: true, catalog_cover_path_2: true, catalog_cover_path_3: true,
      subscription_active: true, subscription_expires_at: true, settings: true, updated_at: true,
    },
  })
}
export type CartaBusiness = NonNullable<Awaited<ReturnType<typeof getCartaBusiness>>>

/** Aislamiento de plantilla y plan, igual que el premium: solo negocios con catalog_template='carta' y catálogo vivo (o su dueño). */
export async function resolveCartaBusiness(slug: string): Promise<CartaBusiness> {
  const business = await getCartaBusiness(slug)
  if (!business) redirect('/catalogo/no-disponible')
  if (business.catalog_template !== 'carta') notFound()
  const session = await getSession()
  const isOwnerPreview = session?.role === 'super_admin' || (session?.role === 'admin' && session.businessId === business.id)
  if (!isOwnerPreview && !isCatalogLive(business)) redirect('/catalogo/no-disponible')
  return business
}

function firstImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : null
  } catch { return null }
}

/** Minúsculas, sin acentos, no alfanuméricos → guion: "Banquetes y eventos" → "banquetes-y-eventos". */
export const slugify = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export interface CartaPageData {
  settings:   CartaSettings
  rate:       number
  categories: CartaCategory[]
  /** Todos los platos visibles, en orden de carta. */
  dishes:     CartaDish[]
  hero:       CartaHero
  /** "De la casa": hasta 3 platos que NO están en el hero (destacados primero; si faltan, se completa). */
  featured:   CartaDish[]
  pagos:      CartaPagos
  payOptions: CartaPayOption[]
  open:       CartaOpenState | null
  horario:    CartaHorarioDia[]
  /** Fotos de ambiente (portadas del negocio) para las bandas entre secciones. */
  bandas:     string[]
  /** Encabezado del negocio: portada(s) a lo ancho, logo en círculo, nombre y dirección. */
  brand:      { covers: string[]; logo: string | null; address: string | null }
  /** WhatsApp del negocio en formato internacional (solo dígitos); null si no hay uno válido. */
  whatsapp:   string | null
  /** Negocio abierto para recibir pedidos (false = cerrado o en pausa). */
  acepta:     boolean
}

export async function loadCarta(business: CartaBusiness): Promise<CartaPageData> {
  const settings = readCartaSettings(business.settings)
  const [products, stockEntries, methods, sliderRow, rate] = await Promise.all([
    prisma.product.findMany({
      where:   { business_id: business.id, active: true, available_in_pos: true, ...CATALOG_WHERE_FILTER },
      include: {
        category: { select: { name: true, sort_order: true } },
        variants: { where: { is_active: true }, select: { id: true, valor: true, stock: true, sort_order: true, ...VARIANT_PRICING_SELECT }, orderBy: { sort_order: 'asc' } },
        option_groups: {
          where:   { is_active: true },
          orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
          include: { options: { where: { is_active: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] } },
        },
      },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.inventoryEntry.groupBy({ by: ['product_id'], where: { business_id: business.id }, _sum: { quantity: true, waste: true } }),
    prisma.paymentMethod.findMany({
      where: { business_id: business.id, is_active: true }, select: { id: true, name: true, type: true, is_financing: true }, orderBy: { sort_order: 'asc' },
    }),
    prisma.landingSection.findFirst({ where: { business_id: business.id, type: 'event_slider', visible: true }, orderBy: { order: 'asc' }, select: { config: true } })
      .catch(() => null),
    getActiveRate(business.id).then(r => r.rate),
  ])

  // Cobro: lo que decide el panel "Cobro y precios" (Divisa y Cashea se pueden apagar; "solo $" oculta los métodos en Bs).
  const eff = readCobroEffective(business.settings)
  const chips = chipMethods(methods, business.settings)
  const divisaOn = chips.divisa.length > 0
  const divisaIds = readDivisaMethodIds(business.settings)

  const stockMap = new Map(stockEntries.map(e => [e.product_id, Number(e._sum.quantity ?? 0) - Number(e._sum.waste ?? 0)]))

  const dishOf = (p: (typeof products)[number]): CartaDish => {
    const onRequest = p.catalog_visibility === 'on_request'
    const sizes: CartaSize[] = onRequest ? [] : p.variants.map(v => ({
      id: v.id, label: v.valor, priceUsd: resolveUnitPriceUsd(p, v), soldOut: tracksStock(p.sale_mode) && v.stock <= 0,
    }))
    const groups: CartaOptionGroup[] = onRequest ? [] : p.option_groups.filter(g => g.options.length > 0).map(g => ({
      id: g.id, name: g.name, required: g.required, multiple: g.multiple, maxSelect: g.max_select,
      options: g.options.map(o => ({ id: o.id, name: o.name, priceExtraUsd: Number(o.price_extra_usd) })),
    }))
    const base = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
    const priceUsd = onRequest ? 0 : sizes.length > 0 ? Math.min(...sizes.map(s => s.priceUsd)) : base
    const netQty = stockMap.get(p.id)
    const stockInput = { has_variants: p.has_variants, variants: p.variants, net_stock: netQty ?? null }
    const tags: CartaTag[] = Array.from(new Set<CartaTag>([...readTags(p.carta_tags), ...(p.badge === 'nuevo' ? (['nuevo'] as const) : [])]))
    return {
      id: p.id, name: p.name, description: p.description, image: firstImage(p.images), categoryName: p.category?.name ?? null,
      priceUsd, priceBs: priceUsd > 0 ? priceUsd * rate : null,
      divisaUsd: !onRequest && divisaOn ? divisaPriceOf(p) : null,
      sizes, groups, tags, allergens: readAllergens(p.allergens),
      isFeatured: p.is_featured,
      onRequest,
      soldOutToday: isSoldOutToday(p.sold_out_date),
      outOfStock: isOutOfStock({ sale_mode: p.sale_mode, ...stockInput }), // regla única: el servicio nunca se agota por stock
    }
  }

  const byCat = new Map<string, { order: number; dishes: CartaDish[] }>()
  for (const p of products) {
    const name = p.category?.name ?? 'Otros'
    const entry = byCat.get(name) ?? { order: p.category?.sort_order ?? 9999, dishes: [] }
    entry.dishes.push(dishOf(p))
    byCat.set(name, entry)
  }
  const categories: CartaCategory[] = Array.from(byCat.entries()).sort((a, b) => a[1].order - b[1].order).map(([name, e]) => ({ name, slug: slugify(name), dishes: e.dishes }))
  const dishes = categories.flatMap(c => c.dishes)

  // Hero: event_slider del negocio; si no hay, favoritos (30 días) y, sin ventas, destacados ("Recomendados").
  const hero = await buildHero(business.id, sliderRow?.config ?? null, dishes)
  const heroIds = new Set<number>(hero.slides.flatMap(s => (s.dish ? [s.dish.id] : linkedDishId(s.cta?.href))))
  const disponible = (d: CartaDish): boolean => !d.outOfStock && !d.soldOutToday && !d.onRequest && !heroIds.has(d.id)
  const pool = dishes.filter(disponible)
  const featured = [...pool.filter(d => d.isFeatured), ...pool.filter(d => !d.isFeatured && d.image), ...pool.filter(d => !d.isFeatured && !d.image)].slice(0, CASA_MAX)

  const casheaMethod = eff.casheaActive ? methods.find(m => m.is_financing) : undefined
  const bsMethods = methods.filter(m => !m.is_financing && !divisaIds.includes(m.id))
  const pagos: CartaPagos = { divisa: chips.divisa.map(m => m.name), bs: !eff.hideBsMethods || !divisaOn, cashea: !!casheaMethod }
  const payOptions: CartaPayOption[] = []
  if (divisaOn) payOptions.push({ kind: 'divisa', label: '$ Divisa', method: chips.divisa[0].name })
  if (pagos.bs) payOptions.push({ kind: 'bs', label: bsMethods[0]?.name ?? 'Bs · tasa BCV', method: bsMethods[0]?.name ?? methods.find(m => !m.is_financing)?.name ?? 'Bs' })
  if (casheaMethod) payOptions.push({ kind: 'cashea', label: 'Cashea', method: casheaMethod.name })

  const hours = readCartaHours(business.settings)
  const open = openState(hours, isCartaPaused(business.settings))
  const wa = normalizePhone(business.whatsapp ?? business.phone ?? '')

  return {
    settings, rate, categories, dishes, hero, featured, pagos, payOptions, open,
    horario: formatHours(hours),
    brand: {
      covers:  [business.catalog_cover_path, business.catalog_cover_path_2, business.catalog_cover_path_3].filter((x): x is string => !!x),
      logo:    business.logo_path || null,
      address: [business.address, business.city].filter(Boolean).join(', ') || null,
    },
    bandas:  [business.catalog_cover_path, business.catalog_cover_path_2, business.catalog_cover_path_3].filter((x): x is string => !!x),
    whatsapp: isValidWaPhone(wa) ? wa : null,
    acepta:  open === null ? true : open.open,
  }
}

/** Solo rutas internas o http(s): nunca javascript: ni data: en un href (el esquema Zod ya lo exige; aquí se repite antes de renderizar). */
const safeHref = (h: string): boolean => /^(https?:\/\/|\/(?!\/)|#)/i.test(h.trim())

function linkedDishId(href: string | undefined): number[] {
  const m = href ? /\/p\/(\d+)/.exec(href) : null
  return m ? [Number(m[1])] : []
}

async function buildHero(businessId: number, sliderConfig: unknown, dishes: CartaDish[]): Promise<CartaHero> {
  const parsed = sliderConfig ? CONFIG_SCHEMAS.event_slider.safeParse(sliderConfig) : null
  if (parsed?.success) {
    const slides: CartaHeroSlide[] = parsed.data.slides.map((s, i) => ({
      key: 'slide-' + i, image: s.image_url, title: s.title ?? '', subtitle: s.subtitle ?? null, dish: null,
      cta: safeHref(s.cta_link) ? { text: s.cta_text, href: s.cta_link } : null, dark: s.text_theme === 'dark',
    }))
    return { kind: 'slides', kicker: 'Hoy en la casa', slides }
  }
  const eligible = dishes.filter(d => !d.outOfStock && !d.soldOutToday && !d.onRequest)
  const topIds = await topSellerIds(businessId, FAVORITOS_MAX).catch(() => [] as number[])
  const top = topIds.map(id => eligible.find(d => d.id === id)).filter((d): d is CartaDish => !!d)
  const picked = top.length > 0 ? top : eligible.filter(d => d.isFeatured).slice(0, FAVORITOS_MAX)
  if (picked.length === 0) return { kind: 'none', kicker: '', slides: [] }
  return {
    kind: 'dishes',
    kicker: top.length > 0 ? 'Los favoritos de la casa' : 'Recomendados',
    slides: picked.map(d => ({ key: 'dish-' + d.id, image: d.image, title: d.name, subtitle: d.description, dish: d, cta: null, dark: false })),
  }
}
