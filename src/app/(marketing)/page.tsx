import type { Metadata } from 'next'
import { getBcvRate } from '@/lib/bcv'
import HeroSection from '@/components/marketing/sections/HeroSection'
import TickerSection from '@/components/marketing/sections/TickerSection'
import SegmentsSection from '@/components/marketing/sections/SegmentsSection'
import SpecsSection from '@/components/marketing/sections/SpecsSection'
import ProblemSection from '@/components/marketing/sections/ProblemSection'
import ComparisonSection from '@/components/marketing/sections/ComparisonSection'
import BCVSection from '@/components/marketing/sections/BCVSection'
import EcosystemSection from '@/components/marketing/sections/EcosystemSection'
import PricingSection from '@/components/marketing/sections/PricingSection'
import TestimonialsSection from '@/components/marketing/sections/TestimonialsSection'
import FinalCTASection from '@/components/marketing/sections/FinalCTASection'
import LandingAnimations from '@/components/marketing/LandingAnimations'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'ActivoPOS — El POS para negocios que andan activos',
  description:
    'POS táctil, BCV automático, catálogo digital, variantes por especificación y cotización de servicios. Diseñado para Venezuela.',
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

export default async function LandingPage() {
  const bcvRate = await getBcvRate()

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      <LandingAnimations />
      <HeroSection bcvRate={bcvRate} />
      <TickerSection />
      <SegmentsSection />
      <SpecsSection bcvRate={bcvRate} />
      <ProblemSection />
      <ComparisonSection />
      <BCVSection bcvRate={bcvRate} />
      <EcosystemSection />
      <PricingSection />
      <TestimonialsSection />
      <FinalCTASection />
    </div>
  )
}
