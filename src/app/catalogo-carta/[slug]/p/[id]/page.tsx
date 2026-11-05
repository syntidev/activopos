import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCartaBusiness, loadCarta, resolveCartaBusiness } from '@/lib/carta/load'
import { cartaDishMeta } from '@/lib/carta/seo'
import { relatedIds } from '@/lib/carta/favoritos'
import { CartaFicha } from '../../CartaFicha'
import { CartaPedido } from '../../CartaPedido'
import type { CartaDish } from '@/types/carta'

interface PageProps {
  params: { slug: string; id: string }
}

const parseId = (raw: string): number | null => (/^\d{1,9}$/.test(raw) ? Number(raw) : null)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = parseId(params.id)
  const biz = await getCartaBusiness(params.slug)
  if (id === null || !biz || biz.catalog_template !== 'carta') return { title: 'Plato no encontrado' }
  const dish = await cartaDishMeta(biz.id, id)
  if (!dish) return { title: 'Plato no encontrado' }
  const title = dish.name + ' — ' + (biz.catalog_title ?? biz.name)
  const description = dish.description ?? 'Pide ' + dish.name + ' en ' + (biz.catalog_title ?? biz.name) + '.'
  const images = dish.image ? [{ url: dish.image, alt: dish.name }] : []
  return { title, description, robots: 'index, follow', openGraph: { title, description, type: 'website', images }, twitter: { card: images.length > 0 ? 'summary_large_image' : 'summary', title, description, images: images.map(i => i.url) } }
}

export default async function PlatoPage({ params }: PageProps) {
  const id = parseId(params.id)
  if (id === null) notFound()
  const business = await resolveCartaBusiness(params.slug)
  const data = await loadCarta(business)
  const dish = data.dishes.find(d => d.id === id)
  if (!dish) notFound()
  const RELATED_MAX = 4
  const byId = new Map(data.dishes.map(d => [d.id, d]))
  const ids = (await relatedIds(business.id, dish.id, RELATED_MAX)).filter(i => i !== dish.id)
  const picked = ids.map(i => byId.get(i)).filter((d): d is CartaDish => !!d && !d.soldOutToday && !d.outOfStock && !d.onRequest)
  const fill = data.dishes.filter(d => d.id !== dish.id && d.categoryName === dish.categoryName && !picked.includes(d) && !d.soldOutToday && !d.outOfStock && !d.onRequest)
  const related = [...picked, ...fill].slice(0, RELATED_MAX)
  return (
    <>
      <CartaFicha dish={dish} slug={params.slug} rate={data.rate} related={related} />
      <CartaPedido slug={params.slug} rate={data.rate} payOptions={data.payOptions} businessName={business.catalog_title ?? business.name} whatsapp={data.whatsapp} acepta={data.acepta} dishes={data.dishes} />
    </>
  )
}
