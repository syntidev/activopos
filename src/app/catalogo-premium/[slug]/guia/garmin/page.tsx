import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { divisaPriceOf } from '@/lib/catalog-divisa'
import { readCobroEffective } from '@/lib/cobro-precios'
import { CATALOG_WHERE_FILTER, isCatalogLive } from '@/lib/catalog'
import { parseKitConfig } from '@/lib/kit-config'
import { normalizePhone } from '@/lib/utils'
import { firstImage, garminGuideEnabled, matchModelIndex } from '@/lib/garmin-guide'
import type { GuideProduct } from '@/types/garmin-guide'
import { catalogHref, fmtBs, fmtUsd } from '../../catalogUtils'
import { CatalogFooter } from '../../CatalogFooter'
import { GarminGuide } from './GarminGuide'
import styles from '../../catalogo.module.css'

interface PageProps {
  params:       { slug: string }
  /** ?producto=<id>: la guía arranca directo con ese producto Garmin. */
  searchParams: { producto?: string }
}

const SLUG_RE = /^[a-z0-9-]{3,50}$/

/** Negocio con catálogo premium vivo y la guía activada (settings.garmin_guide = true); si no, null → 404. */
async function loadGuideBusiness(slug: string) {
  if (!SLUG_RE.test(slug)) return null
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      id: true, name: true, phone: true, theme_color: true, logo_path: true, city: true, state: true,
      catalog_plan: true, catalog_template: true, subscription_active: true, subscription_expires_at: true,
      catalog_desc: true, catalog_instagram: true, catalog_hours: true, rif: true, address: true,
      settings: true, kit200k_config: true,
    },
  })
  if (!business || !isCatalogLive(business) || business.catalog_template !== 'premium') return null
  return garminGuideEnabled(business.settings) ? business : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const business = await loadGuideBusiness(params.slug)
  if (!business) return { title: 'Guía no encontrada' }
  return {
    title:       `Configura tu Garmin paso a paso — ${business.name}`,
    description: 'Elige tu equipo Garmin y sigue una guía hecha para él: carga, emparejamiento, primera actividad y más.',
  }
}

export default async function GuiaGarminPage({ params, searchParams }: PageProps) {
  const business = await loadGuideBusiness(params.slug)
  if (!business) notFound()

  // Productos de marca Garmin visibles en el catálogo (mismo scope que las fichas): equipos con guía y accesorios.
  const [rows, { rate }] = await Promise.all([
    prisma.product.findMany({
      where:   { business_id: business.id, active: true, available_in_pos: true, brand: { name: 'Garmin' }, ...CATALOG_WHERE_FILTER },
      select:  {
        id: true, name: true, images: true, catalog_visibility: true,
        price_per_unit_usd: true, price_per_kg_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true,
      },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    }),
    getActiveRate(business.id),
  ])

  // Regla única de precio: principal = Divisa (si está activa y es válida) o precio completo; Bs = completo × tasa activa.
  const divisaOn = readCobroEffective(business.settings).divisaActive
  const products: GuideProduct[] = rows.map(p => {
    const full = Number((p.price_per_unit_usd ?? p.price_per_kg_usd)?.toString() ?? 0)
    const main = (divisaOn ? divisaPriceOf(p) : null) ?? full
    const consult = p.catalog_visibility === 'on_request' || !(main > 0)
    return {
      id: p.id, name: p.name, image: firstImage(p.images), modelIndex: matchModelIndex(p.name), consult,
      priceUsd: consult ? null : fmtUsd(main),
      priceBs:  consult || !(rate > 0) ? null : fmtBs(full * rate),
      href:     catalogHref(params.slug, `/p/${p.id}`),
    }
  })

  const producto = Number(searchParams.producto)
  const location = [business.city, business.state].filter(Boolean).join(', ')
  const kit = parseKitConfig(business.kit200k_config)

  return (
    <div
      data-theme="light"
      className={styles.root}
      style={business.theme_color ? ({ '--biz-color': business.theme_color } as React.CSSProperties) : undefined}
    >
      <GarminGuide
        slug={params.slug}
        businessName={business.name}
        businessLogo={business.logo_path}
        businessCity={location || null}
        whatsapp={normalizePhone(business.phone ?? '')}
        showKitLink={kit.activo && kit.mostrar_en_header}
        watches={products.filter(p => p.modelIndex !== null)}
        accessories={products.filter(p => p.modelIndex === null)}
        initialProductId={Number.isInteger(producto) && producto > 0 ? producto : null}
      >
        <CatalogFooter
          slug={params.slug}
          displayTitle={business.name}
          logoPath={business.logo_path}
          catalogDesc={business.catalog_desc ?? null}
          rif={business.rif ?? null}
          address={business.address ?? null}
          location={location}
          waPhone={business.phone?.replace(/\D/g, '') ?? ''}
          phone={business.phone}
          catalogInstagram={business.catalog_instagram ?? null}
          catalogHours={business.catalog_hours ?? null}
        />
      </GarminGuide>
    </div>
  )
}
