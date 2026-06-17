import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MessageCircle, MapPin } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { CatalogoGrid } from './CatalogoGrid'
import type { CatalogProduct, PaymentMethod } from './CatalogoGrid'
import styles from './catalogo.module.css'

interface PageProps {
  params: { slug: string }
}

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
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
      catalog_title: true,
      catalog_desc:  true,
      theme_color:   true,
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

  const [products, rate, stockEntries, paymentMethods] = await Promise.all([
    prisma.product.findMany({
      where: {
        business_id:      business.id,
        active:           true,
        show_in_catalog:  true,
        available_in_pos: true,
      },
      include: {
        category: { select: { name: true } },
      },
      orderBy: [{ category_id: 'asc' }, { name: 'asc' }],
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
      categoryName: p.category?.name ?? null,
      priceUsd,
      priceBs,
      outOfStock:   netQty !== undefined && netQty <= 0,
    }
  })

  const categories = Array.from(
    new Set(
      catalogProducts
        .map(p => p.categoryName)
        .filter((c): c is string => c !== null),
    ),
  )

  const displayTitle = business.catalog_title ?? business.name
  const initials     = getInitials(displayTitle)
  const location     = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone      = business.phone?.replace(/\D/g, '') ?? ''
  const waUrl        = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent('Hola, vi tu catálogo en ActivoPOS y me interesa pedir.')}`
    : null

  return (
    <div className={`light ${styles.root}`}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {business.logo_path ? (
            <img
              src={business.logo_path}
              alt={`Logo de ${business.name}`}
              className={styles.logo}
              width={80}
              height={80}
            />
          ) : (
            <div
              className={styles.initials}
              style={business.theme_color
                ? { '--initials-bg': business.theme_color } as React.CSSProperties
                : undefined}
              aria-hidden="true"
            >
              {initials}
            </div>
          )}
          <div className={styles.bizInfo}>
            <h1 className={styles.bizName}>{displayTitle}</h1>
            {business.catalog_desc && (
              <p className={styles.bizDesc}>{business.catalog_desc}</p>
            )}
            {location && (
              <p className={styles.bizLocation}>
                <MapPin size={12} strokeWidth={2} aria-hidden="true" />
                {location}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── BCV Bar ─────────────────────────────────────────────── */}
      <div className={styles.rateBar}>
        <span className={styles.rateLabel}>Tasa BCV</span>
        <span className={styles.rateSep}>·</span>
        <span className={styles.rateValue}>
          Bs.&nbsp;{rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* ── Grid + Tabs (Client Component) ──────────────────────── */}
      <CatalogoGrid
          products={catalogProducts}
          categories={categories}
          slug={params.slug}
          rate={rate}
          paymentMethods={paymentMethods as PaymentMethod[]}
        />

      {/* ── WhatsApp FAB ────────────────────────────────────────── */}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waFab}
          aria-label="Contactar por WhatsApp"
        >
          <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
          <span className={styles.waFabText}>Pedir por WhatsApp</span>
        </a>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <p>
          Catálogo digital con{' '}
          <a href="https://activopos.com" target="_blank" rel="noopener noreferrer">
            ActivoPOS
          </a>
        </p>
      </footer>
    </div>
  )
}
