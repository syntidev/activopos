import Script from 'next/script'
import { loadIdentityBusiness } from '@/lib/web-identity'
import { readSeo } from '@/lib/seo'
import { productJsonLd, serializeJsonLd, storeJsonLd } from '@/lib/seo-schema'

/**
 * Piezas de SEO/analítica de los catálogos PÚBLICOS (nunca el panel ni el POS: solo se montan desde los layouts y páginas de catálogo).
 * Server Components: el ID de GA4 sale de business.settings, ya validado con regex (G-XXXXXXXX); ninguno está escrito en el código.
 */

/** gtag.js de GA4 del negocio. Sin ga4_id válido no emite nada. */
export async function Ga4({ slug }: { slug: string }) {
  const b = await loadIdentityBusiness(slug)
  const id = b ? readSeo(b.settings).ga4_id : null
  if (!id) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(id)});`}
      </Script>
    </>
  )
}

function JsonLd({ data }: { data: object | null }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}

/** JSON-LD de la portada: Store (premium/genérico) o CafeOrCoffeeShop (carta). */
export async function StoreSchema({ slug }: { slug: string }) {
  return <JsonLd data={await storeJsonLd(slug)} />
}

/** JSON-LD de la ficha: Product con precio USD y disponibilidad real. */
export async function ProductSchema({ slug, id }: { slug: string; id: number }) {
  return <JsonLd data={await productJsonLd(slug, id)} />
}
