import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parseKitConfig } from '@/lib/kit-config'
import { Kit200KForm } from './Kit200KForm'
import styles from './kit200k.module.css'

// Landing standalone de preventa — un solo tenant (OnBike), un solo kit visible.
// Ruta fija, sin [slug]: es el patrón "página de evento", no una feature
// multi-tenant genérica (ver nota de scope en el commit).
const SLUG = 'onbike'
// UN SOLO combo real, siempre -- nunca crear un segundo producto combo en
// paralelo (ej. un "Kit 200K Básico" con menos componentes). Si en algún
// momento falta un componente real (ej. sin Maillot en inventario), el
// flujo correcto es EDITAR este mismo product_id: bajar precio_per_unit_usd,
// quitar el ProductComponent que falte, renombrar a "Kit 200K Reducido"
// mientras dure esa condición, y revertir el nombre cuando se repone.
// Decisión de Carlos tras retirar "Kit 200K Básico" (859, combo paralelo) --
// quedó desactivado (active=false), no borrado, por si hace falta auditar.
// Por ese invariante el kit se resuelve como "el combo activo" (mismo criterio
// que api/public/kit-200k/[slug]), sin depender de su nombre.

// Sin esto Next la prerrenderiza estática al build (ruta fija, sin [slug]) y
// el flag reservas_enabled / kit_id quedan congelados hasta el próximo
// deploy -- esta página depende de estado de DB que cambia sin redeploy.
export const dynamic = 'force-dynamic'

// SEO previo, usado mientras la config del Kit no tenga seo_title/seo_description.
const FALLBACK_TITLE       = 'Kit Oficial 200K — Reserva | OnBike Margarita'
const FALLBACK_DESCRIPTION = 'Reserva tu Kit Oficial 200K del Gran Fondo Virgen del Valle — Maillot y Medias oficiales del evento, franela incluida.'

// Mismo criterio que api/public/kit-200k/[slug]: solo assets propios hacia afuera.
const INTERNAL_IMAGE_RE = /^\/(uploads|storage\/tenants)\//
function firstInternalImage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return null
    return list.find((src): src is string => typeof src === 'string' && INTERNAL_IMAGE_RE.test(src)) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: SLUG, active: true },
    select: { kit200k_config: true },
  })
  const config = parseKitConfig(business?.kit200k_config ?? null)
  return {
    title:       config.seo_title || FALLBACK_TITLE,
    description: config.seo_description || FALLBACK_DESCRIPTION,
    robots:      { index: true, follow: true },
  }
}

export default async function Kit200KPage() {
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: SLUG, active: true },
    select: {
      id:                true,
      reservas_enabled:  true,
      name:              true,
      logo_path:         true,
      city:              true,
      state:             true,
      phone:             true,
      rif:               true,
      address:           true,
      catalog_title:     true,
      catalog_desc:      true,
      catalog_desc_enabled: true,
      catalog_instagram: true,
      catalog_hours:     true,
      kit200k_config:    true,
    },
  })
  if (!business) notFound()

  const kit = await prisma.product.findFirst({
    where:  { business_id: business.id, product_type: 'combo', active: true },
    select: { id: true, images: true },
  })
  if (!kit) notFound()

  const config = parseKitConfig(business.kit200k_config)

  // Componentes reales del combo (Maillot/Medalla/Media hoy), mismo origen que
  // api/public/kit-200k/[slug]. La franela incluida en el kit NO es componente.
  const componentLinks = await prisma.productComponent.findMany({
    where:   { parent_id: kit.id },
    include: { component: { select: { id: true, name: true, active: true, images: true } } },
  })
  const componentes = componentLinks
    .filter(l => l.component.active)
    .map(l => ({ id: l.component.id, nombre: l.component.name, imagen: firstInternalImage(l.component.images) }))

  // Franelas sueltas del showroom -- productos reales (TAREA: ensamblar Kit
  // 200K con el mecanismo combo/product existente). Si alguna no existe (aún
  // no seedeada / desactivada), esa card del showroom queda sin product_id
  // real y Kit200KForm deshabilita su "Agregar" en vez de mandar un string suelto.
  //
  // Hardcode anterior matchaba el nombre COMPLETO con año ("Franela 200K 2027
  // Damas") -- se rompía cada año. Dato real que sobrevive al cambio de año
  // (confirmado contra DB): están en la misma colección del Kit (slug "200k",
  // sin año) y, a diferencia de Maillot/Media/Medalla, NINGUNA es
  // ProductComponent de un combo -- son "sueltas", no parte del bundle. Eso
  // ya aísla las 3 franelas sin año en el filtro; el nombre solo decide a
  // CUÁL de las 3 corresponde cada card (Damas/Caballeros/Niños) -- no hay
  // campo de género/edad en Product, así que esa palabra (estable, sin año)
  // es la única señal que queda para ese mapeo puntual.
  const franelaProducts = await prisma.product.findMany({
    where: {
      business_id:  business.id,
      active:       true,
      product_type: { not: 'combo' },
      usedIn:       { none: {} },
      collections:  { some: { collection: { slug: '200k' } } },
    },
    select: { id: true, name: true, images: true, variants: { where: { is_active: true }, select: { id: true, valor: true } } },
  })
  const findFranela = (genero: string) => {
    const p = franelaProducts.find(fp => fp.name.includes(genero))
    return p ? { productId: p.id, variants: p.variants, imagen: firstInternalImage(p.images) } : null
  }
  const franelaDamas       = findFranela('Damas')
  const franelaCaballeros  = findFranela('Caballeros')
  const franelaNinos       = findFranela('Niños')

  if (!business.reservas_enabled) {
    return (
      <div className={styles.disabledState}>
        <p>Las reservas del Kit 200K no están disponibles en este momento.</p>
      </div>
    )
  }

  const displayTitle = business.catalog_title ?? business.name
  const location      = [business.city, business.state].filter(Boolean).join(', ')
  const waPhone        = business.phone?.replace(/\D/g, '') ?? ''
  const catalogDesc  = business.catalog_desc_enabled ? (business.catalog_desc ?? null) : null

  return (
    <Kit200KForm
      slug={SLUG}
      kitId={kit.id}
      kitImage={firstInternalImage(kit.images)}
      badgeHero={config.badge_hero}
      showKitLink={config.activo && config.mostrar_en_header}
      componentes={componentes}
      businessName={displayTitle}
      businessLogo={business.logo_path}
      businessCity={location || null}
      catalogDesc={catalogDesc}
      rif={business.rif ?? null}
      address={business.address ?? null}
      location={location}
      waPhone={waPhone}
      phone={business.phone}
      catalogInstagram={business.catalog_instagram ?? null}
      catalogHours={business.catalog_hours ?? null}
      franelaDamas={franelaDamas}
      franelaCaballeros={franelaCaballeros}
      franelaNinos={franelaNinos}
    />
  )
}
