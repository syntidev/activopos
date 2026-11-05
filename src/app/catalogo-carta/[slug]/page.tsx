import type { Metadata } from 'next'
import { getCartaBusiness, loadCarta, resolveCartaBusiness } from '@/lib/carta/load'
import { cartaOgImage } from '@/lib/carta/seo'
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
  const image = await cartaOgImage(biz.id)
  const images = image ? [{ url: image, alt: title }] : []
  return {
    title:       title + ' — Carta',
    description,
    robots:      'index, follow',
    openGraph:   { title, description, type: 'website', images },
    twitter:     { card: images.length > 0 ? 'summary_large_image' : 'summary', title, description, images: images.map(i => i.url) },
  }
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
