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
    select: { id: true, reservas_enabled: true },
  })
  if (!business) notFound()

  const kit = await prisma.product.findFirst({
    where:  { business_id: business.id, product_type: 'combo', active: true, name: KIT_NAME },
    select: { id: true },
  })
  if (!kit) notFound()

  if (!business.reservas_enabled) {
    return (
      <div className={styles.disabledState}>
        <p>Las reservas del Kit 200K no están disponibles en este momento.</p>
      </div>
    )
  }

  return <Kit200KForm slug={SLUG} kitId={kit.id} />
}
