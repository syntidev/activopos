import type { Metadata } from 'next'
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
  },
}

async function fetchBCVRate(): Promise<number> {
  try {
    const port = process.env.PORT ?? '3001'
    const base = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${port}`
    const res = await fetch(`${base}/api/rates/bcv`, { next: { revalidate: 300 } })
    const data = await res.json()
    if (data.ok && data.rate) return parseFloat(data.rate)
  } catch {}
  return 0
}

export default async function LandingPage() {
  const bcvRate = await fetchBCVRate()

  return (
    <div className={styles.page}>
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
