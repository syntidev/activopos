import type { Metadata } from 'next'
import { getCartaBusiness, loadCarta, resolveCartaBusiness } from '@/lib/carta/load'
import { publicUrl, shareMetadata } from '@/lib/og/metadata'
import { withSeo } from '@/lib/seo'
import { StoreSchema } from '@/components/catalog/CatalogSeo'
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
  // SEO del negocio (Configuración > SEO y Analítica): seo_title/seo_description mandan sobre el título y la descripción de la carta.
  return shareMetadata(withSeo({
    title: title + ' — Carta', description, robots: 'index, follow', kind: 'website' as const,
    path:      `/c/${params.slug}`,
    imagePath: `/api/og/portada/${params.slug}?v=${biz.updated_at.getTime()}`,
    imageAlt:  title,
  }, biz.settings))
}

export default async function CartaPage({ params }: PageProps) {
  const business = await resolveCartaBusiness(params.slug)
  const data = await loadCarta(business)
  return (
    <>
      <StoreSchema slug={params.slug} />
      <CartaHome slug={params.slug} businessName={business.catalog_title ?? business.name} hoursText={business.catalog_hours} city={business.city} data={data} shareUrl={publicUrl(`/c/${params.slug}`)} />
      <CartaPedido slug={params.slug} rate={data.rate} payOptions={data.payOptions} businessName={business.catalog_title ?? business.name} whatsapp={data.whatsapp} acepta={data.acepta} dishes={data.dishes} />
    </>
  )
}
