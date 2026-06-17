import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
    openGraph: {
      title,
      description,
      type:   'website',
      images: ogImages,
    },
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

  const [products, rate] = await Promise.all([
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
  ])

  const displayTitle = business.catalog_title ?? business.name
  const location     = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone      = business.phone?.replace(/\D/g, '') ?? ''
  const waUrl        = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent('Hola, vi tu catálogo en ActivoPOS y me interesa pedir.')}`
    : null

  return (
    <div className={`light ${styles.root}`}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {business.logo_path && (
            <img
              src={business.logo_path}
              alt={`Logo de ${business.name}`}
              className={styles.logo}
              width={72}
              height={72}
            />
          )}
          <div className={styles.bizInfo}>
            <h1 className={styles.bizName}>{displayTitle}</h1>
            {business.catalog_desc && (
              <p className={styles.bizDesc}>{business.catalog_desc}</p>
            )}
            {location && <p className={styles.bizLocation}>{location}</p>}
          </div>
        </div>
      </header>

      <div className={styles.rateBar}>
        <span className={styles.rateLabel}>Tasa BCV</span>
        <span className={styles.rateValue}>
          Bs.&nbsp;{rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <main className={styles.main}>
        {products.length === 0 ? (
          <div className={styles.empty}>
            <p>No hay productos disponibles en este catálogo.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {products.map(p => {
              const imgs     = parseImages(p.images)
              const priceUsd = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
              const priceBs  = priceUsd > 0 ? priceUsd * rate : null
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
                      {priceUsd > 0 && (
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
                      )}
                    </div>
                    {p.sku && <span className={styles.sku}>Ref: {p.sku}</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waFab}
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}

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
