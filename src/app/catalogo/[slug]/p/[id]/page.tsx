import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'
import { isCatalogLive, CATALOG_WHERE_FILTER } from '@/lib/catalog'
import { ProductoDetalle } from '../../ProductoDetalle'
import { CatalogFooter } from '../../CatalogFooter'
import styles from '../../catalogo.module.css'

interface PageProps {
  params: { slug: string; id: string }
}

function parseImages(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const productId = parseInt(params.id, 10)
  if (isNaN(productId)) return { title: 'Producto no encontrado' }

  // SEC: sin scope por business_id, esta query filtraba por id de producto
  // solamente — un product_id de OTRO tenant filtraba nombre/desc/imagen en
  // el <title>/OG de este slug (IDOR cross-tenant). Mismo scope que la page.
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, catalog_active: true, active: true },
    select: { id: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
  })
  if (!business || !isCatalogLive(business)) return { title: 'Producto no encontrado' }

  const product = await prisma.product.findFirst({
    where: { id: productId, business_id: business.id, active: true, show_in_catalog: true },
    select: { name: true, description: true, images: true },
  })
  if (!product) return { title: 'Producto no encontrado' }

  const imgs = parseImages(product.images)
  return {
    title:       product.name,
    description: product.description ?? `Ver ${product.name} en el catálogo`,
    openGraph: {
      title:  product.name,
      images: imgs[0] ? [{ url: imgs[0] }] : [],
    },
  }
}

export default async function ProductoPage({ params }: PageProps) {
  const productId = parseInt(params.id, 10)
  if (isNaN(productId)) notFound()

  const business = await prisma.business.findFirst({
    where:  { catalog_slug: params.slug, catalog_active: true, active: true },
    select: {
      id: true, name: true, phone: true, theme_color: true, logo_path: true,
      catalog_plan: true, subscription_active: true, subscription_expires_at: true,
      city: true, state: true, catalog_desc: true, catalog_instagram: true,
      catalog_hours: true, legal_name: true, rif: true, address: true,
    },
  })
  if (!business || !isCatalogLive(business)) notFound()

  const [product, rate] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id:               productId,
        business_id:      business.id,
        active:           true,
        show_in_catalog:  true,
        available_in_pos: true,
        ...CATALOG_WHERE_FILTER,
      },
      include: {
        category: { select: { name: true, color: true } },
        variants: {
          where:  { is_active: true },
          select: { id: true, tipo: true, valor: true, stock: true, precio_extra: true, combination_key: true },
        },
      },
    }),
    getBcvRate(),
  ])
  if (!product) notFound()

  const imgs      = parseImages(product.images)
  const priceUsd  = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
  const priceBs   = priceUsd > 0 ? priceUsd * rate : null
  const location  = [business.city, business.state].filter(Boolean).join(', ')

  const relatedRaw = await prisma.product.findMany({
    where: {
      business_id:       business.id,
      active:            true,
      show_in_catalog:   true,
      available_in_pos:  true,
      category_id:       product.category_id,
      id:                { not: productId },
      ...CATALOG_WHERE_FILTER,
    },
    select: {
      id:                 true,
      name:               true,
      images:             true,
      price_per_unit_usd: true,
      price_per_kg_usd:   true,
    },
    take:    4,
    orderBy: { is_featured: 'desc' },
  })
  const relatedProducts = relatedRaw.map(rp => ({
    id:       rp.id,
    name:     rp.name,
    image:    parseImages(rp.images)[0] ?? null,
    priceUsd: Number(rp.price_per_unit_usd ?? rp.price_per_kg_usd ?? 0),
  }))

  return (
    <div
      data-theme="light"
      className={`${styles.root} ${styles.rootDetail}`}
      style={business.theme_color
        ? ({ '--biz-color': business.theme_color } as React.CSSProperties)
        : undefined}
    >
      <ProductoDetalle
        name={product.name}
        description={product.description}
        images={imgs}
        categoryName={product.category?.name ?? null}
        categoryColor={product.category?.color ?? null}
        priceUsd={priceUsd}
        priceBs={priceBs}
        variants={product.variants.map(v => ({
          id:              v.id,
          tipo:            v.tipo,
          valor:           v.valor,
          stock:           v.stock,
          precio_extra:    Number(v.precio_extra),
          combination_key: v.combination_key,
        }))}
        businessPhone={business.phone?.replace(/\D/g, '') ?? ''}
        businessName={business.name}
        slug={params.slug}
        rate={rate}
        catalogUrl={`/catalogo/${params.slug}`}
        relatedProducts={relatedProducts}
        businessLogo={business.logo_path}
      />
      <CatalogFooter
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
    </div>
  )
}
