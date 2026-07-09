import type { Metadata } from 'next'
import { Fraunces, DM_Sans } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import styles from './marketing.module.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://activopos.com'),
  title: {
    template: '%s | ActivoPOS',
    default: 'ActivoPOS — El POS para negocios que andan activos',
  },
  description:
    'Sistema de punto de venta e inventario diseñado para PYMES venezolanas. Control en tiempo real, precios en USD y Bs, catálogo público y más.',
  keywords: [
    'POS Venezuela', 'punto de venta', 'inventario PYME', 'sistema de ventas Venezuela',
    'control de caja', 'catálogo digital', 'facturación Venezuela',
  ],
  authors: [{ name: 'synti.dev' }],
  openGraph: {
    type: 'website',
    url: 'https://activopos.com/',
    locale: 'es_VE',
    siteName: 'ActivoPOS',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ActivoPOS — El POS para negocios que andan activos' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ActivoPOS — El POS para negocios que andan activos',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const segments = await prisma.segment.findMany({
    where:   { active: true },
    orderBy: { sort_order: 'asc' },
    select:  { slug: true, name: true, tag_line: true },
  })

  return (
    <div
      className={`${styles.root} ${fraunces.variable} ${dmSans.variable}`}
      data-theme="dark"
    >
      <MarketingNav segments={segments} />
      <main className={styles.main}>{children}</main>
      <MarketingFooter />
    </div>
  )
}
