import type { Metadata } from 'next'
import { getCartaBusiness, loadCarta, resolveCartaBusiness } from '@/lib/carta/load'
import { shareMetadata } from '@/lib/og/metadata'
import { CartaHome } from './CartaHome'
import { CartaPedido } from './CartaPedido'

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const biz = await getCartaBusiness(params.slug)
  if (!biz || biz.catalog_template !== 'carta') return { title: 'Carta no encontrada' }
  const title = biz.catalog_title ?? biz.name
  const description = biz.catalog_desc ?? 'Carta de ' + biz.name + '. Pide desde tu teléfono.'
  return shareMetadata({
    title: title + ' — Carta', description, robots: 'index, follow', kind: 'website',
    path:      `/c/${params.slug}`,
    imagePath: `/api/og/portada/${params.slug}?v=${biz.updated_at.getTime()}`,
    imageAlt:  title,
  })
}

export default async function CartaPage({ params }: PageProps) {
  const business = await resolveCartaBusiness(params.slug)
  const data = await loadCarta(business)
  return (
    <>
      <CartaHome slug={params.slug} businessName={business.catalog_title ?? business.name} hoursText={business.catalog_hours} city={business.city} data={data} />
      <CartaPedido slug={params.slug} rate={data.rate} payOptions={data.payOptions} businessName={business.catalog_title ?? business.name} whatsapp={data.whatsapp} acepta={data.acepta} dishes={data.dishes} />
    </>
  )
}
