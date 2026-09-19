import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getActiveRate } from '@/lib/bcv'
import { CatalogoGrid } from './CatalogoGrid'
import type { CatalogProduct, PaymentMethod } from './CatalogoGrid'
import { CatalogFooter } from './CatalogFooter'
import { CONFIG_SCHEMAS, isSectionType } from '@/lib/landing-sections'
import type { RenderableLandingSection, CollectionGridProduct } from '@/lib/landing-sections'
import { CATALOG_WHERE_FILTER, computeAvailability, isCatalogLive } from '@/lib/catalog'
import styles from './catalogo.module.css'

interface PageProps {
  params: { slug: string }
}

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

/* Fallback de descripción cuando el negocio no escribió catalog_desc (o lo
   desactivó con el toggle): usa el headline real del Segment (oración
   completa tipo "Vendés al kilo. Cobrás en dólares y Bs.") en vez de
   tag_line (categorías separadas por · — menos natural como texto de hero).
   Match EXACTO por slug -- Business.segment usa el vocabulario del wizard
   de /registro (bodega, ferreteria, farmacia...), que NO siempre coincide
   con Segment.slug (ferreterias, farmacias, plural -- ver diagnóstico). Si
   no hay match, cae en null -- mismo comportamiento que "sin segmento". */
async function getSegmentFallbackDesc(segment: string | null): Promise<string | null> {
  if (!segment) return null
  const seg = await prisma.segment.findFirst({ where: { slug: segment }, select: { headline: true } })
  return seg?.headline ?? null
}

// Resuelve las secciones collection_grid: {collection_id} guardado en DB ->
// nombre + productos activos de esa colección, mismo tenant. Batched (1 query
// para todas las secciones) en vez de N+1. Colecciones sin productos activos
// o inexistentes se descartan silenciosamente (mismo criterio que config corrupta).
async function resolveCollectionGridSections(
  sections: RenderableLandingSection[],
  businessId: number,
  rate: number,
): Promise<RenderableLandingSection[]> {
  const collectionIds = Array.from(new Set(
    sections
      .filter((s): s is Extract<RenderableLandingSection, { type: 'collection_grid' }> => s.type === 'collection_grid')
      .map(s => s.config.collection_id),
  ))
  if (collectionIds.length === 0) return sections

  const collections = await prisma.collection.findMany({
    where:   { id: { in: collectionIds }, business_id: businessId, active: true },
    select: {
      id: true, name: true,
      products: {
        select: {
          product: {
            select: {
              id: true, name: true, images: true,
              price_per_unit_usd: true, price_per_kg_usd: true,
              active: true, show_in_catalog: true,
            },
          },
        },
      },
    },
  })

  const byId = new Map(collections.map(c => {
    const products: CollectionGridProduct[] = c.products
      .map(pc => pc.product)
      .filter(p => p.active && p.show_in_catalog)
      .map(p => {
        const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
        return {
          id:       p.id,
          name:     p.name,
          image:    parseImages(p.images)[0] ?? null,
          priceUsd,
          priceBs:  priceUsd > 0 ? priceUsd * rate : null,
        }
      })
    return [c.id, { name: c.name, products }]
  }))

  return sections.flatMap((s): RenderableLandingSection[] => {
    if (s.type !== 'collection_grid') return [s]
    const resolved = byId.get(s.config.collection_id)
    // Colección inexistente/de otro tenant -> se descarta (config corrupta,
    // mismo criterio que el resto de landing sections). Colección real con
    // products:[] SÍ se mantiene -- el componente muestra un placeholder en
    // vez de desaparecer, para que la sección quede lista desde ya y solo
    // falte cargar productos reales de la línea 200K.
    if (!resolved) return []
    return [{
      id: s.id, order: s.order, type: 'collection_grid',
      config: { ...s.config, collection_name: resolved.name, products: resolved.products },
    }]
  })
}

async function getBusiness(slug: string) {
  return prisma.business.findFirst({
    where: { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      id:            true,
      name:          true,
      logo_path:     true,
      phone:         true,
      city:          true,
      state:         true,
      legal_name: true,
      rif:        true,
      address:    true,
      catalog_title: true,
      catalog_desc:  true,
      catalog_desc_enabled: true,
      catalog_default_currency: true,
      segment:       true,
      catalog_hours:     true,
      catalog_instagram: true,
      catalog_cover_path: true,
      catalog_cover_path_2: true,
      catalog_cover_path_3: true,
      theme_color:   true,
      catalog_plan:            true,
      catalog_template:        true,
      subscription_active:     true,
      subscription_expires_at: true,
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const biz = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, active: true },
    select: { name: true, catalog_title: true, catalog_desc: true, logo_path: true },
  })
  if (!biz) return { title: 'Catálogo no encontrado' }

  const title       = biz.catalog_title ?? biz.name
  const description = biz.catalog_desc ?? `Catálogo de productos de ${biz.name}`
  const ogImages    = biz.logo_path ? [{ url: biz.logo_path, alt: title }] : []

  return {
    title:       `${title} — Catálogo`,
    description,
    robots:      'index, follow',
    openGraph:   { title, description, type: 'website', images: ogImages },
    twitter: {
      card:        ogImages.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images:      ogImages.map(i => i.url),
    },
  }
}

export default async function CatalogoPage({ params }: PageProps) {
  const business = await getBusiness(params.slug)
  if (!business) redirect('/catalogo/no-disponible')

  // Aislamiento de plantilla: este fork es exclusivo de tenants con
  // catalog_template='premium'. Sin bypass de owner/super_admin -- a
  // diferencia del plan-gate de abajo, esto no es un preview, es la
  // plantilla que el negocio tiene asignada.
  if (business.catalog_template !== 'premium') notFound()

  // SEC: bypass del plan-gate solo para el propio negocio — super_admin ve cualquiera
  // (acceso global, igual que el resto del sistema); admin solo el suyo.
  const session = await getSession()
  const isOwnerPreview =
    session?.role === 'super_admin' ||
    (session?.role === 'admin' && session.businessId === business.id)

  if (!isOwnerPreview && !isCatalogLive(business)) redirect('/catalogo/no-disponible')

  const [products, rate, stockEntries, paymentMethods, dbCategories, landingSectionRows, brandRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id:        business.id,
        active:             true,
        show_in_catalog:    true,
        available_in_pos:   true,
        ...CATALOG_WHERE_FILTER,
      },
      include: {
        category: { select: { name: true, color: true, sort_order: true } },
        variants: {
          where:  { is_active: true },
          select: { id: true, tipo: true, valor: true, stock: true, precio_extra: true, combination_key: true, variant_group: true, sku: true },
        },
      },
      orderBy: [{ is_featured: 'desc' }, { category_id: 'asc' }, { name: 'asc' }],
    }),
    getActiveRate(business.id).then(r => r.rate),
    prisma.inventoryEntry.groupBy({
      by:    ['product_id'],
      where: { business_id: business.id },
      _sum:  { quantity: true, waste: true },
    }),
    prisma.paymentMethod.findMany({
      where:   { business_id: business.id, is_active: true },
      select:  { id: true, name: true, type: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.category.findMany({
      where:   { business_id: business.id, active: true },
      select:  { name: true, color: true, sort_order: true, image_url: true },
      orderBy: { sort_order: 'asc' },
    }),
    // Landing Sections (Fase 1) — directo por Prisma, igual que products/categories:
    // esta página es un server component sin sesión de usuario (visitante anónimo),
    // así que /api/landing-sections (autenticado, getAuthenticatedTenant) no aplica
    // acá. Try/catch propio: un fallo acá nunca debe tumbar el resto del catálogo.
    prisma.landingSection.findMany({
      where:   { business_id: business.id, visible: true },
      select:  { id: true, type: true, order: true, config: true },
      orderBy: { order: 'asc' },
    }).catch(() => []),
    // "Comprá por marca" (Configuración > Marcas) — mismo motivo que Landing
    // Sections: server component sin sesión, /api/brands no aplica acá.
    prisma.brand.findMany({
      where:   { business_id: business.id, visible: true },
      select:  { name: true, image_url: true, search_term: true },
      orderBy: { order: 'asc' },
    }).catch(() => []),
  ])

  // Config es JSON crudo en DB — se revalida contra el mismo schema Zod que la
  // API de admin usa para escribir (fuente única de verdad). Una fila con tipo
  // desconocido o config corrupta se descarta en vez de romper el render.
  const parsedSections = landingSectionRows.flatMap(row => {
    if (!isSectionType(row.type)) return []
    const parsed = CONFIG_SCHEMAS[row.type].safeParse(row.config)
    if (!parsed.success) return []
    return [{ id: row.id, order: row.order, type: row.type, config: parsed.data } as RenderableLandingSection]
  })

  // collection_grid solo guarda collection_id en DB -- acá se resuelve nombre +
  // productos vía Prisma directo (mismo motivo que Landing Sections: page.tsx es
  // server component sin sesión, GET /api/collections/[slug]/products es
  // autenticado y no aplica a un visitante anónimo). Una query batched (in:) en
  // vez de N+1 por sección. Colección sin productos activos o inexistente -> la
  // sección se descarta, no rompe el resto del catálogo.
  const landingSections = await resolveCollectionGridSections(parsedSections, business.id, rate)

  const stockMap = new Map<number, number>()
  for (const e of stockEntries) {
    stockMap.set(
      e.product_id,
      Number(e._sum.quantity ?? 0) - Number(e._sum.waste ?? 0),
    )
  }

  // Serialize products for client component — no Decimal/Date types
  const catalogProducts: CatalogProduct[] = products.map(p => {
    const imgs     = parseImages(p.images)
    const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
    const priceBs  = priceUsd > 0 ? priceUsd * rate : null
    const netQty   = stockMap.get(p.id)
    return {
      id:           p.id,
      name:         p.name,
      description:  p.description,
      image:        imgs[0] ?? null,
      images:       imgs,
      categoryName: p.category?.name ?? null,
      priceUsd,
      priceBs,
      isService:    p.sale_mode === 'service',
      stockQty:     p.sale_mode === 'service' ? null : (netQty ?? null),
      outOfStock:   p.sale_mode !== 'service' && (
        (p.has_variants && p.unit_type === 'unit')
          ? !p.variants.some(v => v.stock > 0)
          : (netQty ?? 0) <= 0
      ),
      badge:            p.badge ?? null,
      subcategory:      p.subcategory ?? null,
      isFeatured:       p.is_featured,
      catalogVisibility: p.catalog_visibility ?? 'visible',
      availability:     computeAvailability({
        sale_mode:    p.sale_mode,
        availability: p.availability ?? 'in_stock',
        net_stock:    netQty ?? null,
        min_stock:    p.min_stock !== null ? Number(p.min_stock) : null,
      }),
      variants: p.variants.map(v => ({
        id:              v.id,
        tipo:            v.tipo,
        valor:           v.valor,
        stock:           v.stock,
        precio_extra:    Number(v.precio_extra),
        combination_key: v.combination_key,
        variant_group:   v.variant_group,
        sku:             v.sku,
      })),
    }
  })

  // Categorías ordenadas por sort_order + mapa de color por categoría.
  // Se deriva de `products` (crudo) porque trae category.sort_order/color.
  const catMeta = new Map<string, { sortOrder: number; color: string | null }>()
  for (const p of products) {
    const c = p.category
    if (c?.name && !catMeta.has(c.name)) {
      catMeta.set(c.name, { sortOrder: c.sort_order, color: c.color })
    }
  }
  const categories = Array.from(catMeta.keys()).sort(
    (a, b) => (catMeta.get(a)!.sortOrder - catMeta.get(b)!.sortOrder) || a.localeCompare(b),
  )
  const categoryColors: Record<string, string | null> = {}
  Array.from(catMeta.entries()).forEach(([name, meta]) => { categoryColors[name] = meta.color })

  // Imagen del círculo de categoría: la propia de Category.image_url si existe; si NO
  // (dato faltante, la causa de círculos vacíos en cada demo — nota Carlos 16 jul),
  // fallback a la imagen del primer producto de esa categoría (catalogProducts ya viene
  // ordenado is_featured desc -> el "destacado" representa la categoría). Así el círculo
  // nunca sale vacío aunque nadie haya subido la imagen a mano.
  const categoryImages: Record<string, string | null> = {}
  dbCategories.forEach(c => {
    if (c.image_url) { categoryImages[c.name] = c.image_url; return }
    const firstWithImg = catalogProducts.find(p => p.categoryName === c.name && p.image)
    categoryImages[c.name] = firstWithImg?.image ?? null
  })

  const displayTitle = business.catalog_title ?? business.name
  const location     = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone      = business.phone?.replace(/\D/g, '') ?? ''
  // Toggle apagado -> nada, sin importar si hay texto guardado (no se pierde,
  // solo se oculta). Toggle prendido -> texto propio, o fallback de segmento.
  const businessDesc = business.catalog_desc_enabled
    ? (business.catalog_desc ?? await getSegmentFallbackDesc(business.segment))
    : null

  return (
    <div
      data-theme="light"
      className={styles.root}
      style={business.theme_color
        ? { '--biz-color': business.theme_color } as React.CSSProperties
        : undefined}
    >
      {/* ── CatalogoGrid: header + hero + search + tabs + grid + modals ── */}
      <CatalogoGrid
        businessId={business.id}
        products={catalogProducts}
        categories={categories}
        categoryColors={categoryColors}
        categoryImages={categoryImages}
        landingSections={landingSections}
        brands={brandRows}
        slug={params.slug}
        rate={rate}
        currency={business.catalog_default_currency}
        paymentMethods={paymentMethods as PaymentMethod[]}
        businessPhone={waPhone}
        businessName={displayTitle}
        businessLogo={business.logo_path}
        businessCity={location || null}
        businessDesc={businessDesc}
        businessHours={business.catalog_hours ?? null}
        businessInstagram={business.catalog_instagram ?? null}
        heroCover={business.catalog_cover_path ?? null}
        heroCovers={[
          business.catalog_cover_path,
          business.catalog_cover_path_2,
          business.catalog_cover_path_3,
        ].filter((x): x is string => Boolean(x))}
        businessLegalName={business.legal_name ?? null}
        businessRif={business.rif ?? null}
        businessAddress={business.address ?? null}
      />

      <CatalogFooter
        slug={params.slug}
        displayTitle={displayTitle}
        logoPath={business.logo_path}
        catalogDesc={businessDesc}
        rif={business.rif ?? null}
        address={business.address ?? null}
        location={location}
        waPhone={waPhone}
        phone={business.phone}
        catalogInstagram={business.catalog_instagram ?? null}
        catalogHours={business.catalog_hours ?? null}
      />
    </div>
  )
}
