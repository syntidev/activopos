import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getActiveRate } from '@/lib/bcv'
import { brandSlug, resolveVitrinaBrand } from '@/lib/vitrina'
import { CATALOG_WHERE_FILTER, computeAvailability, effectiveStock, isOutOfStock, isCatalogLive, stockDisplayOf } from '@/lib/catalog'
import type { VitrinaContext } from '@/types/vitrina'
import { CatalogoGrid } from '../../CatalogoGrid'
import { readSynonyms } from '@/lib/search-synonyms'
import type { CatalogProduct, PaymentMethod } from '../../CatalogoGrid'
import { CatalogFooter } from '../../CatalogFooter'
import styles from '../../catalogo.module.css'

// Vitrina de marca: mismo catálogo premium, acotado a UNA marca (products.brand_id), sin selector de
// marcas ni enlaces al resto. Carrito/checkout vienen del layout compartido de [slug].
interface PageProps {
  params:       { slug: string; marca: string }
  searchParams: { categoria?: string; sub?: string; buscar?: string }
}

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const biz = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, catalog_active: true, active: true, catalog_template: 'premium' },
    select: { id: true, name: true, catalog_title: true },
  })
  if (!biz) return { title: 'Catálogo no encontrado' }
  const brand = await resolveVitrinaBrand(biz.id, params.marca)
  if (!brand) return { title: 'Marca no encontrada' }
  return { title: `${brand.name} — ${biz.catalog_title ?? biz.name}`, description: `Productos ${brand.name} de ${biz.catalog_title ?? biz.name}` }
}

export default async function VitrinaMarcaPage({ params, searchParams }: PageProps) {
  const business = await prisma.business.findFirst({
    where: { catalog_slug: params.slug, catalog_active: true, active: true },
    select: {
      id:                      true,
      name:                    true,
      logo_path:               true,
      phone:                   true,
      city:                    true,
      state:                   true,
      catalog_title:           true,
      catalog_desc:            true,
      catalog_default_currency: true, settings: true,
      catalog_hours:           true,
      catalog_instagram:       true,
      theme_color:             true,
      catalog_plan:            true,
      catalog_template:        true,
      subscription_active:     true,
      subscription_expires_at: true,
      legal_name:              true,
      rif:                     true,
      address:                 true,
    },
  })
  if (!business) notFound()
  // Aislamiento de plantilla — ver nota en ../../page.tsx.
  if (business.catalog_template !== 'premium') notFound()

  const session = await getSession()
  const isOwnerPreview =
    session?.role === 'super_admin' ||
    (session?.role === 'admin' && session.businessId === business.id)
  if (!isOwnerPreview && !isCatalogLive(business)) notFound()

  // Marca inexistente, de otro negocio u oculta (visible=false) -> 404.
  const brand = await resolveVitrinaBrand(business.id, params.marca)
  if (!brand) notFound()

  const vitrina: VitrinaContext = {
    href:       `/catalogo-premium/${params.slug}/marca/${brandSlug(brand.name)}`,
    marca:      brandSlug(brand.name),
    brandName:  brand.name,
    brandImage: brand.image_url,
  }

  const [products, rate, stockEntries, paymentMethods] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id:      business.id,
        brand_id:         brand.id,
        active:           true,
        available_in_pos: true,
        ...CATALOG_WHERE_FILTER,
      },
      include: {
        category: { select: { name: true, color: true, sort_order: true } },
        brand:    { select: { name: true } },
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
      where: { business_id: business.id, product: { brand_id: brand.id } },
      _sum:  { quantity: true, waste: true },
    }),
    prisma.paymentMethod.findMany({
      where:   { business_id: business.id, is_active: true },
      select:  { id: true, name: true, type: true, is_financing: true },
      orderBy: { sort_order: 'asc' },
    }),
  ])

  const stockMap = new Map<number, number>()
  for (const e of stockEntries) {
    stockMap.set(e.product_id, Number(e._sum.quantity ?? 0) - Number(e._sum.waste ?? 0))
  }

  const hideStock = stockDisplayOf(business.settings) === 'status'
  const catalogProducts: CatalogProduct[] = products.map(p => {
    const imgs     = parseImages(p.images)
    const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
    const netQty   = stockMap.get(p.id)
    return {
      id:                p.id,
      name:              p.name,
      description:       p.description,
      image:             imgs[0] ?? null,
      images:            imgs,
      categoryName:      p.category?.name ?? null,
      brandId:           p.brand_id ?? null,
      brandName:         p.brand?.name ?? null,
      priceUsd,
      priceBs:           priceUsd > 0 ? priceUsd * rate : null,
      isService:         p.sale_mode === 'service',
      stockQty:          hideStock || p.sale_mode === 'service' ? null : effectiveStock({ has_variants: p.has_variants, variants: p.variants, net_stock: netQty ?? null }),
      stockHidden:       hideStock,
      outOfStock:        isOutOfStock({ sale_mode: p.sale_mode, has_variants: p.has_variants, variants: p.variants, net_stock: netQty ?? null }),
      badge:             p.badge ?? null,
      subcategory:       p.subcategory ?? null,
      isFeatured:        p.is_featured,
      catalogVisibility: p.catalog_visibility ?? 'visible',
      availability:      computeAvailability({
        sale_mode:    p.sale_mode,
        availability: p.availability ?? 'in_stock',
        net_stock:    netQty ?? null,
        min_stock:    p.min_stock !== null ? Number(p.min_stock) : null,
        has_variants: p.has_variants,
        variants:     p.variants,
      }),
      variants: p.variants.map(v => ({
        id:              v.id,
        tipo:            v.tipo,
        valor:           v.valor,
        stock:           hideStock ? null : v.stock,
        soldOut:         v.stock <= 0,
        precio_extra:    Number(v.precio_extra),
        combination_key: v.combination_key,
        variant_group:   v.variant_group,
        sku:             v.sku,
      })),
    }
  })

  // Categorías (y colores) solo de los productos de la marca: el filtro nunca ofrece una categoría vacía.
  const catMeta = new Map<string, { sortOrder: number; color: string | null }>()
  for (const p of products) {
    const c = p.category
    if (c?.name && !catMeta.has(c.name)) catMeta.set(c.name, { sortOrder: c.sort_order, color: c.color })
  }
  const categories = Array.from(catMeta.keys()).sort(
    (a, b) => (catMeta.get(a)!.sortOrder - catMeta.get(b)!.sortOrder) || a.localeCompare(b),
  )
  const categoryColors: Record<string, string | null> = {}
  Array.from(catMeta.entries()).forEach(([name, meta]) => { categoryColors[name] = meta.color })

  const displayTitle = business.catalog_title ?? business.name
  const location     = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone      = business.phone?.replace(/\D/g, '') ?? ''

  return (
    <div
      data-theme="light"
      className={styles.root}
      style={business.theme_color
        ? ({ '--biz-color': business.theme_color } as React.CSSProperties)
        : undefined}
    >
      <CatalogoGrid
        searchSynonyms={readSynonyms(business.settings)}
        businessId={business.id}
        products={catalogProducts}
        categories={categories}
        categoryColors={categoryColors}
        categoryImages={{}}
        slug={params.slug}
        rate={rate}
        currency={business.catalog_default_currency}
        paymentMethods={paymentMethods as PaymentMethod[]}
        businessPhone={waPhone}
        businessName={displayTitle}
        businessLogo={business.logo_path}
        businessCity={location || null}
        businessDesc={business.catalog_desc ?? null}
        businessHours={business.catalog_hours ?? null}
        businessInstagram={business.catalog_instagram ?? null}
        businessLegalName={business.legal_name ?? null}
        businessRif={business.rif ?? null}
        businessAddress={business.address ?? null}
        catalogMode="productos"
        initialCategory={searchParams.categoria ?? null}
        initialSub={searchParams.sub ?? null}
        initialQuery={searchParams.buscar ?? null}
        vitrina={vitrina}
      />
      <CatalogFooter
        slug={params.slug}
        displayTitle={displayTitle}
        logoPath={business.logo_path}
        catalogDesc={business.catalog_desc ?? null}
        rif={business.rif ?? null}
        address={business.address ?? null}
        location={location}
        waPhone={waPhone}
        phone={business.phone}
        catalogInstagram={business.catalog_instagram ?? null}
        catalogHours={business.catalog_hours ?? null}
        hideNav
      />
    </div>
  )
}
