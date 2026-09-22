import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Kit200KForm } from './Kit200KForm'
import styles from './kit200k.module.css'

// Landing standalone de preventa — un solo tenant (OnBike), un solo kit visible.
// Ruta fija, sin [slug]: es el patrón "página de evento", no una feature
// multi-tenant genérica (ver nota de scope en el commit).
const SLUG = 'onbike'
const KIT_NAME = 'Kit 200K Completo'

// Sin esto Next la prerrenderiza estática al build (ruta fija, sin [slug]) y
// el flag reservas_enabled / kit_id quedan congelados hasta el próximo
// deploy -- esta página depende de estado de DB que cambia sin redeploy.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Kit Oficial 200K — Reserva | OnBike Margarita',
  description: 'Reserva tu Kit Oficial 200K del Gran Fondo Virgen del Valle — Maillot y Medias oficiales del evento, franela incluida.',
  robots: { index: true, follow: true },
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
    },
  })
  if (!business) notFound()

  const kit = await prisma.product.findFirst({
    where:  { business_id: business.id, product_type: 'combo', active: true, name: KIT_NAME },
    select: { id: true },
  })
  if (!kit) notFound()

  // Franelas sueltas del showroom -- productos reales (TAREA: ensamblar Kit
  // 200K con el mecanismo combo/product existente). Si alguna no existe (aún
  // no seedeada / desactivada), esa card del showroom queda sin product_id
  // real y Kit200KForm deshabilita su "Agregar" en vez de mandar un string suelto.
  const franelaProducts = await prisma.product.findMany({
    where: {
      business_id: business.id,
      active:      true,
      name:        { in: ['Franela 200K 2027 Damas', 'Franela 200K 2027 Caballeros', 'Franela 200K 2027 Niños'] },
    },
    select: { id: true, name: true, variants: { where: { is_active: true }, select: { id: true, valor: true } } },
  })
  const findFranela = (name: string) => {
    const p = franelaProducts.find(fp => fp.name === name)
    return p ? { productId: p.id, variants: p.variants } : null
  }
  const franelaDamas       = findFranela('Franela 200K 2027 Damas')
  const franelaCaballeros  = findFranela('Franela 200K 2027 Caballeros')
  const franelaNinos       = findFranela('Franela 200K 2027 Niños')

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
