import type { Metadata } from 'next'
import { getBcvRate } from '@/lib/bcv'
import HeroSection from '@/components/marketing/sections/HeroSection'
import TickerSection from '@/components/marketing/sections/TickerSection'
import ProductBentoSection from '@/components/marketing/sections/ProductBentoSection'
import FeatureListBentoSection from '@/components/marketing/sections/FeatureListBentoSection'
import PaymentMethodsSection from '@/components/marketing/sections/PaymentMethodsSection'
import SegmentsSection from '@/components/marketing/sections/SegmentsSection'
import FeatureTabsSection from '@/components/marketing/sections/FeatureTabsSection'
import FinancialBrainSection from '@/components/marketing/sections/FinancialBrainSection'
import CatalogShowcaseSection from '@/components/marketing/sections/CatalogShowcaseSection'
import PricingSection from '@/components/marketing/sections/PricingSection'
import TestimonialsSection from '@/components/marketing/sections/TestimonialsSection'
import FinalCTASection from '@/components/marketing/sections/FinalCTASection'
import LandingAnimations from '@/components/marketing/LandingAnimations'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'El POS para negocios que andan activos',
  description:
    'POS táctil, BCV automático, catálogo digital, variantes por especificación y cotización de servicios. Diseñado para Venezuela.',
  alternates: {
    canonical: 'https://activopos.com',
  },
  openGraph: {
    title: 'ActivoPOS — El POS para negocios que andan activos',
    description: 'Sistema de punto de venta e inventario para PYMES venezolanas.',
    url: 'https://activopos.com/',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ActivoPOS — El POS para negocios que andan activos' }],
  },
}

export const revalidate = 300

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ActivoPOS',
  url: 'https://activopos.com',
  logo: 'https://activopos.com/activopos-logo-flat-positive.png',
  description: 'POS SaaS para negocios venezolanos',
  sameAs: ['https://instagram.com/activopos'],
}

const SOFTWARE_APPLICATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ActivoPOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Sistema de control de ventas e inventario para PYMEs venezolanas. No reemplaza la facturación SENIAT, la complementa.',
  url: 'https://activopos.com',
  offers: [
    { '@type': 'Offer', name: 'Mostrador', price: '15.00', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
    { '@type': 'Offer', name: 'Negocio',   price: '25.00', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
    { '@type': 'Offer', name: 'Pro',       price: '40.00', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
  ],
  provider: {
    '@type': 'Organization',
    name: 'SYNTIdev',
    url: 'https://synti.dev',
  },
}

export default async function LandingPage() {
  const bcvRate = await getBcvRate()

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD).replace(/</g, '\\u003c') }}
      />
      <LandingAnimations />
      <HeroSection bcvRate={bcvRate} />
      <TickerSection />
      <ProductBentoSection />
      <FeatureListBentoSection />
      <PaymentMethodsSection />
      <SegmentsSection />
      <FeatureTabsSection />
      <FinancialBrainSection bcvRate={bcvRate} />
      <CatalogShowcaseSection />
      <PricingSection bcvRate={bcvRate} />
      <TestimonialsSection />
      <FinalCTASection />
    </div>
  )
}
