import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { CATALOG_WHERE_FILTER, isCatalogLive } from '@/lib/catalog'
import { parseKitConfig } from '@/lib/kit-config'
import { normalizePhone } from '@/lib/utils'
import { GUIDE_FAMILIES, GUIDE_MODELS, garminGuideEnabled, matchFamily, matchModelIndex, modelImages } from '@/lib/garmin-guide'
import { CatalogFooter } from '../../CatalogFooter'
import { GarminGuide } from './GarminGuide'
import styles from '../../catalogo.module.css'

interface PageProps {
  params:       { slug: string }
  /** ?modelo=<nombre del producto o del modelo>: preselecciona el modelo de la guía. */
  searchParams: { modelo?: string }
}

const MODELO_MAX = 120

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
    title:       `Tu Garmin en ${business.name}, paso a paso`,
    description: 'Elige tu reloj Garmin y sigue una guía hecha para él: carga, emparejamiento, primera actividad y más.',
  }
}

export default async function GuiaGarminPage({ params, searchParams }: PageProps) {
  const business = await loadGuideBusiness(params.slug)
  if (!business) notFound()

  // Productos de marca Garmin visibles en el catálogo: de ahí sale la foto de cada modelo.
  const products = await prisma.product.findMany({
    where:   { business_id: business.id, active: true, available_in_pos: true, brand: { name: 'Garmin' }, ...CATALOG_WHERE_FILTER },
    select:  { name: true, images: true },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })

  const modelo = (searchParams.modelo ?? '').slice(0, MODELO_MAX)
  const initialModel = modelo ? matchModelIndex(modelo) : null
  const initialFamily = initialModel !== null ? GUIDE_MODELS[initialModel].family : (modelo ? matchFamily(modelo) : null) ?? GUIDE_FAMILIES[0]
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
        modelImages={modelImages(products)}
        initialFamily={initialFamily}
        initialModel={initialModel}
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
