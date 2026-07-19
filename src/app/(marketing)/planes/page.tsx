import type { Metadata } from 'next'
import { Check, MessageCircle, Tag } from 'lucide-react'
import MarketingHero from '@/components/marketing/MarketingHero'
import { getParallelRate } from '@/lib/bcv'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import { featuresForTier, featuresByCategoryForTier } from '@/lib/plan-features'
import { WA_BASE } from '@/lib/marketing-contact'
import PricingSection from '@/components/marketing/sections/PricingSection'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Planes y precios',
  description:
    'ActivoPOS tiene 2 planes: Gratis para siempre y Negocio Activo con todo incluido. Precios reales en USD, ciclo mensual, trimestral, semestral o anual, sin sorpresas.',
  alternates: { canonical: '/planes' },
  openGraph: {
    title: 'Planes y precios — ActivoPOS',
    description: 'Gratis para siempre o Negocio Activo con todo incluido. Precios reales en USD.',
    url: 'https://activopos.com/planes',
  },
}

export const revalidate = 300

const TIERS: PlanTier[] = ['gratis', 'negocio_activo']

const FAQS = [
  {
    q: '¿Puedo cambiar de plan?',
    a: 'Sí, en cualquier momento desde Configuración. El cambio aplica de inmediato y el cobro se ajusta al nuevo plan en tu próximo ciclo.',
  },
  {
    q: '¿Hay contrato?',
    a: 'No hay contrato ni permanencia obligatoria. Pagas mes a mes, y si eliges un ciclo más largo (trimestral, semestral o anual) obtienes un descuento — pero sigue siendo tu decisión, sin letra pequeña.',
  },
  {
    q: '¿Qué pasa si no pago?',
    a: 'Si tienes el plan Negocio Activo y no renuevas, se bloquean los módulos de pago — catálogo digital, finanzas, proveedores, exportables y alta de nuevos productos o usuarios — hasta que te pongas al día. Tu POS sigue funcionando para que no se te pare el día a día, y nunca perdemos tu información. El plan Gratis no tiene este riesgo: no vence ni se corta.',
  },
  {
    q: '¿El plan Gratis vence?',
    a: 'No. El plan Gratis es permanente: no vence, no pide tarjeta y no se convierte en pago solo. Úsalo el tiempo que quieras; subes a Negocio Activo únicamente cuando lo necesites.',
  },
]

function buildProductJsonLd() {
  return TIERS.map(tier => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `ActivoPOS ${PLAN_DISPLAY[tier]}`,
    description: `Plan ${PLAN_DISPLAY[tier]} de ActivoPOS — sistema de punto de venta e inventario para Venezuela.`,
    brand: { '@type': 'Brand', name: 'ActivoPOS' },
    offers: {
      '@type': 'Offer',
      price: tier === 'gratis' ? '0.00' : BILLING_CYCLES[tier].mensual.monthlyEquivalent.toFixed(2),
      priceCurrency: 'USD',
      priceValidUntil: '2027-01-01',
      availability: 'https://schema.org/InStock',
      url: 'https://activopos.com/planes',
    },
  }))
}

export default async function PlanesPage() {
  // Precio de suscripción en Bs = tasa paralela, nunca BCV. 0 => la card oculta el Bs.
  const bcvRate = (await getParallelRate()) ?? 0
  const productJsonLd = buildProductJsonLd()
  const gratisFeats = featuresForTier('gratis')
  const paidGroups = featuresByCategoryForTier('negocio_activo')

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <MarketingHero icon={Tag} maxWidth={1100} className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Planes claros. Precios reales.</h1>
          <p className={styles.subtitle}>
            Todos los planes en dólares, sin contrato anual. Compara cada detalle antes de decidir.
          </p>
        </div>
      </MarketingHero>

      <PricingSection bcvRate={bcvRate} showHeader={false} showMoreLink={false} />

      <section className={styles.compareSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Todo lo que incluye cada plan</h2>
          <div className={styles.compareGrid}>
            <div className={styles.comparePanel}>
              <h3 className={styles.comparePlanName}>Gratis</h3>
              <p className={styles.comparePlanNote}>Lo esencial para empezar a vender hoy, sin pagar nada.</p>
              <ul className={styles.compareList}>
                {gratisFeats.map(f => (
                  <li key={f}>
                    <Check size={15} aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${styles.comparePanel} ${styles.comparePanelFeatured}`}>
              <span className={styles.compareBadge}>Todo incluido</span>
              <h3 className={styles.comparePlanName}>Negocio Activo</h3>
              <p className={styles.comparePlanNote}>Todo lo de Gratis, más cada módulo del sistema.</p>
              <div className={styles.categoryGrid}>
                {paidGroups.map(group => (
                  <div key={group.category} className={styles.categoryBlock}>
                    <span className={styles.categoryLabel}>{group.label}</span>
                    <ul className={styles.categoryList}>
                      {group.items.map(f => (
                        <li key={f}>
                          <Check size={14} aria-hidden="true" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Preguntas frecuentes</h2>
          <div className={styles.faqGrid}>
            {FAQS.map(faq => (
              <div key={faq.q} className={styles.faqItem}>
                <h3 className={styles.faqQ}>{faq.q}</h3>
                <p className={styles.faqA}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2 className={styles.ctaTitle}>¿Tienes dudas sobre cuál plan elegir?</h2>
          <a
            href={`${WA_BASE}?text=Hola%2C+tengo+dudas+sobre+los+planes+de+ActivoPOS`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaBtn}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Escríbenos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
