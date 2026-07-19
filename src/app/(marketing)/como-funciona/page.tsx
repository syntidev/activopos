import type { Metadata } from 'next'
import { Workflow } from 'lucide-react'
import MarketingHero from '@/components/marketing/MarketingHero'
import FeatureTabsSection from '@/components/marketing/sections/FeatureTabsSection'
import CatalogShowcaseSection from '@/components/marketing/sections/CatalogShowcaseSection'
import styles from './como-funciona.module.css'

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description:
    'Un sistema, tres formas de trabajar: cobros con BCV automático, variantes por especificación y panel de cocina. Más tu catálogo digital conectado al inventario.',
  alternates: {
    canonical: 'https://activopos.com/como-funciona',
  },
  openGraph: {
    title: 'Cómo funciona ActivoPOS',
    description: 'Cobros, variantes, cocina y catálogo digital — el POS que se adapta a cómo trabaja tu negocio.',
    url: 'https://activopos.com/como-funciona',
  },
}

export default function ComoFuncionaPage() {
  return (
    <>
      <MarketingHero icon={Workflow} maxWidth={760} className={styles.hero}>
        <p className={styles.eyebrow}>Cómo funciona</p>
        <h1 className={styles.title}>Cobros, variantes y cocina — a tu manera</h1>
        <p className={styles.subtitle}>
          Un POS que se adapta a cómo trabaja tu negocio, no al revés.
        </p>
      </MarketingHero>
      <FeatureTabsSection />
      <CatalogShowcaseSection />
    </>
  )
}
