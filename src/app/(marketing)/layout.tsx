import type { Metadata } from 'next'
import { Fraunces, DM_Sans } from 'next/font/google'
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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ActivoPOS — El POS para negocios que andan activos',
  },
  robots: { index: true, follow: true },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${styles.root} ${fraunces.variable} ${dmSans.variable}`}
      data-theme="dark"
    >
      <MarketingNav />
      <main className={styles.main}>{children}</main>
      <MarketingFooter />
    </div>
  )
}
