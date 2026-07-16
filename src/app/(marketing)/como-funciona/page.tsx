import type { Metadata } from 'next'
import FeatureTabsSection from '@/components/marketing/sections/FeatureTabsSection'
import CatalogShowcaseSection from '@/components/marketing/sections/CatalogShowcaseSection'

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
      <FeatureTabsSection />
      <CatalogShowcaseSection />
    </>
  )
}
