import type { Metadata } from 'next'
import { Check, X, MessageCircle } from 'lucide-react'
import { getBcvRate } from '@/lib/bcv'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import PlanToggle from './PlanToggle'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Planes y precios — ActivoPOS',
  description:
    'Compara los 3 planes de ActivoPOS en detalle: Mostrador, Negocio y Pro. Precios reales en USD, ciclo mensual, semestral o anual, sin sorpresas.',
  alternates: { canonical: '/planes' },
  openGraph: {
    title: 'Planes y precios — ActivoPOS',
    description: 'Compara los 3 planes de ActivoPOS en detalle. Precios reales en USD.',
    url: 'https://activopos.com/planes',
  },
}

export const revalidate = 300

const TIERS: Exclude<PlanTier, 'trial'>[] = ['inicio', 'pro', 'business']

interface FeatureRow {
  label: string
  values: [boolean | string, boolean | string, boolean | string]
}

const FEATURES: FeatureRow[] = [
  { label: 'POS táctil en cualquier pantalla',              values: [true, true, true] },
  { label: 'BCV automático en cada venta',                   values: [true, true, true] },
  { label: 'Pago Móvil, Zelle, Efectivo, USDT',              values: [true, true, true] },
  { label: 'Gestión de proveedores',                         values: [true, true, true] },
  { label: 'Usuarios',                                       values: ['Hasta 3', 'Hasta 10', 'Ilimitados'] },
  { label: 'Productos',                                      values: ['Hasta 100', 'Hasta 500', 'Ilimitados'] },
  { label: 'Catálogo digital con pedidos por WhatsApp',      values: [false, true, true] },
  { label: 'Cotizaciones en PDF',                             values: [false, true, true] },
  { label: 'Cuentas por cobrar y finanzas completas',        values: [false, true, true] },
  { label: 'Analytics avanzado',                              values: [false, false, true] },
  { label: 'Panel de cocina (KDS)',                           values: [false, false, true] },
  { label: 'Soporte prioritario',                             values: [false, false, true] },
]

const FAQS = [
  {
    q: '¿Puedo cambiar de plan?',
    a: 'Sí, en cualquier momento desde Configuración. El cambio aplica de inmediato y el cobro se ajusta al nuevo plan en tu próximo ciclo.',
  },
  {
    q: '¿Hay contrato?',
    a: 'No. Todos los planes son mes a mes (o el ciclo que elijas). Sin contrato anual obligatorio, sin letra pequeña.',
  },
  {
    q: '¿Qué pasa si no pago?',
    a: 'Tu cuenta pasa a modo de solo lectura — puedes ver tu historial pero no registrar ventas nuevas hasta ponerte al día. Nunca perdemos tu información.',
  },
  {
    q: '¿Los precios incluyen impuestos?',
    a: 'Los precios mostrados son en USD, antes de cualquier impuesto o comisión de tu método de pago. ActivoPOS no genera tu factura fiscal SENIAT — la complementa.',
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
      price: BILLING_CYCLES[tier].mensual.monthlyEquivalent.toFixed(2),
      priceCurrency: 'USD',
      priceValidUntil: '2027-01-01',
      availability: 'https://schema.org/InStock',
      url: 'https://activopos.com/planes',
    },
  }))
}

export default async function PlanesPage() {
  const bcvRate = await getBcvRate()
  const productJsonLd = buildProductJsonLd()

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Planes claros. Precios reales.</h1>
          <p className={styles.subtitle}>
            Todos los planes en dólares, sin contrato anual. Compara cada detalle antes de decidir.
          </p>
        </div>
      </section>

      <PlanToggle bcvRate={bcvRate} />

      <section className={styles.matrixSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Todo lo que incluye cada plan</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.thFeature}>Función</th>
                  {TIERS.map(tier => (
                    <th key={tier} scope="col" className={styles.thPlan}>{PLAN_DISPLAY[tier]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(row => (
                  <tr key={row.label}>
                    <th scope="row" className={styles.rowLabel}>{row.label}</th>
                    {row.values.map((v, i) => (
                      <td key={i} className={styles.cell}>
                        {typeof v === 'boolean'
                          ? (v
                            ? <Check size={16} aria-label="Incluido" className={styles.checkYes} />
                            : <X size={16} aria-label="No incluido" className={styles.checkNo} />)
                          : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
            href="https://wa.me/584222654827?text=Hola%2C+tengo+dudas+sobre+los+planes+de+ActivoPOS"
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
