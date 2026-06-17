import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MessageCircle, Package, MapPin } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
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

  const [products, rate, stockEntries] = await Promise.all([
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
  ])

  const stockMap = new Map<number, number>()
  for (const e of stockEntries) {
    stockMap.set(
      e.product_id,
      Number(e._sum.quantity ?? 0) - Number(e._sum.waste ?? 0),
    )
  }

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

      {/* ── Products ────────────────────────────────────────────── */}
      <main className={styles.main}>
        {products.length === 0 ? (
          <div className={styles.empty}>
            <Package
              className={styles.emptyIcon}
              size={52}
              strokeWidth={1.25}
              aria-hidden="true"
            />
            <h2 className={styles.emptyTitle}>Catálogo en construcción</h2>
            <p className={styles.emptySubtitle}>
              Este negocio está preparando su vitrina digital.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map(p => {
              const imgs     = parseImages(p.images)
              const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
              const priceBs  = priceUsd > 0 ? priceUsd * rate : null
              const netQty   = stockMap.get(p.id)
              const outOfStock = netQty !== undefined && netQty <= 0

              return (
                <article key={p.id} className={styles.card}>
                  <div className={styles.cardImage}>
                    {imgs[0] ? (
                      <img
                        src={imgs[0]}
                        alt={p.name}
                        className={styles.productImg}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.noImage} aria-hidden="true" />
                    )}
                    {outOfStock && (
                      <span className={styles.badgeSinStock}>Sin stock</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    {p.category && (
                      <span className={styles.category}>{p.category.name}</span>
                    )}
                    <h2 className={styles.productName}>{p.name}</h2>
                    {p.description && (
                      <p className={styles.productDesc}>{p.description}</p>
                    )}
                    <div className={styles.priceRow}>
                      {priceUsd > 0 ? (
                        <>
                          <span className={styles.priceUsd}>
                            ${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          {priceBs && (
                            <span className={styles.priceBs}>
                              Bs.&nbsp;{priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.priceConsultar}>Consultar precio</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

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
