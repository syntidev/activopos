import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getBcvRate } from '@/lib/bcv'
import { CatalogoGrid } from './CatalogoGrid'
import type { CatalogProduct, PaymentMethod } from './CatalogoGrid'
import { CATALOG_WHERE_FILTER, computeAvailability, isCatalogLive } from '@/lib/catalog'
import styles from './catalogo.module.css'

interface PageProps {
  params: { slug: string }
}

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
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
      catalog_hours:     true,
      catalog_instagram: true,
      catalog_cover_path: true,
      theme_color:   true,
      catalog_plan:            true,
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
  if (!business) notFound()

  // SEC: bypass del plan-gate solo para el propio negocio — super_admin ve cualquiera
  // (acceso global, igual que el resto del sistema); admin solo el suyo.
  const session = await getSession()
  const isOwnerPreview =
    session?.role === 'super_admin' ||
    (session?.role === 'admin' && session.businessId === business.id)

  if (!isOwnerPreview && !isCatalogLive(business)) notFound()

  const [products, rate, stockEntries, paymentMethods] = await Promise.all([
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
          select: { id: true, tipo: true, valor: true, stock: true, precio_extra: true, combination_key: true },
        },
      },
      orderBy: [{ is_featured: 'desc' }, { category_id: 'asc' }, { name: 'asc' }],
    }),
    getBcvRate(),
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
  ])

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

  const displayTitle = business.catalog_title ?? business.name
  const location     = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone      = business.phone?.replace(/\D/g, '') ?? ''

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
        products={catalogProducts}
        categories={categories}
        categoryColors={categoryColors}
        slug={params.slug}
        rate={rate}
        paymentMethods={paymentMethods as PaymentMethod[]}
        businessPhone={waPhone}
        businessName={displayTitle}
        businessLogo={business.logo_path}
        businessCity={location || null}
        businessDesc={business.catalog_desc ?? null}
        businessHours={business.catalog_hours ?? null}
        businessInstagram={business.catalog_instagram ?? null}
        heroCover={business.catalog_cover_path ?? null}
        businessLegalName={business.legal_name ?? null}
        businessRif={business.rif ?? null}
        businessAddress={business.address ?? null}
      />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerBiz}>
          {displayTitle && (
            <p className={styles.footerBizName}>{displayTitle}</p>
          )}
          {business.legal_name && (
            <p className={styles.footerBizLegal}>{business.legal_name}</p>
          )}
          {business.rif && (
            <p className={styles.footerBizRif}>RIF: {business.rif}</p>
          )}
          {business.address && (
            <p className={styles.footerBizAddress}>{business.address}</p>
          )}
          {location && (
            <p className={styles.footerBizCity}>{location}</p>
          )}
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerBizPhone}
            >
              {waPhone}
            </a>
          )}
        </div>
        <div className={styles.footerPowered}>
          <p>
            Impulsado por{' '}
            <a href="https://activopos.com" target="_blank" rel="noopener noreferrer">
              ActivoPOS
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
