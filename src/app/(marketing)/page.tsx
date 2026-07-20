import type { Metadata } from 'next'
import { getBcvRate, getParallelRate } from '@/lib/bcv'
import HeroSection from '@/components/marketing/sections/HeroSection'
import PainSection from '@/components/marketing/sections/PainSection'
import LivePulseSection from '@/components/marketing/sections/LivePulseSection'
import TickerSection from '@/components/marketing/sections/TickerSection'
import FeatureListBentoSection from '@/components/marketing/sections/FeatureListBentoSection'
import SegmentsSection from '@/components/marketing/sections/SegmentsSection'
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

// Escapa `<` para que el JSON no pueda cerrar el <script> contenedor
const ld = (obj: unknown): string => JSON.stringify(obj).replace(/</g, '\\u003c')

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ActivoPOS',
  url: 'https://activopos.com',
  logo: 'https://activopos.com/activopos-logo-flat-positive.png',
  description: 'Sistema de punto de venta e inventario diseñado nativamente para pequeñas y medianas empresas venezolanas.',
  foundingDate: '2025',
  areaServed: 'VE',
  knowsLanguage: 'es-VE',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    availableLanguage: 'Spanish',
    url: 'https://wa.me/584243244788',
  },
  parentOrganization: {
    '@type': 'Organization',
    name: 'SYNTIdev',
    url: 'https://synti.dev',
  },
  sameAs: [
    'https://synti.dev',
    'https://syntiweb.com',
    'https://lleva.app',
    'https://ordena.menu',
    'https://instagram.com/activopos',
    'https://facebook.com/activopos',
  ],
}

const SOFTWARE_APPLICATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ActivoPOS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'POS SaaS multimoneda para negocios venezolanos. Ventas, inventario, catálogo digital con checkout por WhatsApp, finanzas y reportes. Funciona desde el celular sin hardware adicional.',
  url: 'https://activopos.com',
  inLanguage: 'es-VE',
  offers: [
    {
      '@type': 'Offer',
      name: 'Gratis',
      price: '0.00',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: 'Hasta 40 productos, 1 usuario, POS táctil, BCV automático. Gratis para siempre.',
    },
    {
      '@type': 'Offer',
      name: 'Negocio Activo — Mensual',
      price: '19.00',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: 'Productos ilimitados, hasta 10 usuarios, catálogo digital, finanzas completas.',
    },
    {
      '@type': 'Offer',
      name: 'Negocio Activo — Anual',
      price: '156.00',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: 'Equivale a $13.00 por mes. 32% de ahorro vs mensual.',
    },
  ],
  provider: {
    '@type': 'Organization',
    name: 'SYNTIdev',
    url: 'https://synti.dev',
  },
  author: {
    '@type': 'Organization',
    name: 'SYNTIdev',
    url: 'https://synti.dev',
  },
}

// FAQPage de homepage — distinto del de /faq (otra URL, sin colisión)
const FAQ_PAGE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿ActivoPOS hace facturación SENIAT?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. ActivoPOS complementa la facturación SENIAT, no la reemplaza. Es un sistema de control de ventas e inventario.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cuánto cuesta ActivoPOS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'El plan Gratis es $0 para siempre. El plan Negocio Activo cuesta $19 al mes, o $13 al mes si pagas anual ($156 al año).',
      },
    },
    {
      '@type': 'Question',
      name: '¿ActivoPOS funciona en Venezuela con Pago Móvil?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí. Acepta Pago Móvil, Zelle, Binance, USDT, Zinli y efectivo. La tasa BCV se actualiza automáticamente en cada venta.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Necesito instalar algo para usar ActivoPOS?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Es una aplicación web que funciona desde el celular, tablet o computadora, sin instalación. No requiere hardware adicional.',
      },
    },
    {
      '@type': 'Question',
      name: '¿ActivoPOS tiene catálogo digital?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí. Incluye catálogo digital público con URL propia, código QR descargable y pedidos por WhatsApp automáticos.',
      },
    },
  ],
}

export default async function LandingPage() {
  const bcvRate = await getBcvRate()
  // Precio de suscripción en Bs = tasa paralela, nunca BCV. 0 => la card oculta el Bs.
  const subscriptionRate = (await getParallelRate()) ?? 0

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld(ORGANIZATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ld(FAQ_PAGE_JSON_LD) }}
      />
      <LandingAnimations />
      <HeroSection bcvRate={bcvRate} />
      <PainSection />
      <LivePulseSection />
      <TickerSection />
      <FeatureListBentoSection />
      <SegmentsSection />
      <PricingSection bcvRate={subscriptionRate} />
      <TestimonialsSection />
      <FinalCTASection />
    </div>
  )
}
