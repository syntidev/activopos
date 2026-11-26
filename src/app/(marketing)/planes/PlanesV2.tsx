import { Check, MessageCircle, Minus, Tag } from 'lucide-react'
import MarketingHero from '@/components/marketing/MarketingHero'
import { INSTALACION_DESDE_USD, LADDER_NAME, PLAN_DISPLAY, WORKING_BILLING_CYCLES, type BillingCycleKey } from '@/lib/plan-limits'
import { NEGOCIO_HIGHLIGHTS, OPERACION_HIGHLIGHTS, comparativaPorCategoria, featuresForTier, type CeldaComparativa } from '@/lib/plan-features'
import { WA_BASE } from '@/lib/marketing-contact'
import PlanesEscalera, { type TarjetaPlan } from './PlanesEscalera'
import base from './page.module.css'
import v from './PlanesV2.module.css'

/**
 * /planes con la escalera v2 (Gratis / Entrada / Operación). Solo se ve con PRICES_PUBLISHED = true (o con ?vista=v2 fuera de producción,
 * para revisarla sin publicar). Todos los precios salen de plan-limits.ts (WORKING_BILLING_CYCLES, INSTALACION_DESDE_USD).
 * NO incluye el add-on KDS (hasta certificar R3) ni nada fiscal.
 */

const NOMBRE = { gratis: PLAN_DISPLAY.gratis, ...LADDER_NAME } as const

const FAQS = [
  {
    q: '¿Puedo cambiar de plan?',
    a: 'Sí, en cualquier momento desde Configuración. El cambio aplica de inmediato y el cobro se ajusta al nuevo plan en tu próximo período.',
  },
  {
    q: '¿Qué significa "precio fijo por el período"?',
    a: 'Que el monto que ves es lo que pagas por todo el período elegido (mes, trimestre, semestre o año), sin cargos extra ni sorpresas. Si eliges un período más largo, el ahorro ya está incluido en ese precio.',
  },
  {
    q: '¿Hay contrato?',
    a: 'No hay contrato ni permanencia obligatoria. Eliges el período que prefieras y renuevas cuando quieras.',
  },
  {
    q: '¿El plan Gratis vence?',
    a: `No. El plan ${NOMBRE.gratis} es permanente: no vence, no pide tarjeta y no se convierte en pago solo. Úsalo el tiempo que quieras y sube a ${NOMBRE.negocio_activo} únicamente cuando lo necesites.`,
  },
  {
    q: '¿Qué pasa si no renuevo?',
    a: 'Se bloquean los módulos de pago hasta que te pongas al día. Tu POS sigue funcionando para que no se pare el día a día, y nunca perdemos tu información.',
  },
]

const CYCLE_LABEL: Record<BillingCycleKey, string> = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
const CICLOS = Object.keys(CYCLE_LABEL) as BillingCycleKey[]

const usd = (n: number): string => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2))

function buildProductJsonLd() {
  const priceValidUntil = `${new Date().getFullYear()}-12-31`
  const url = 'https://activopos.com/planes'
  return (['gratis', 'negocio_activo', 'operacion'] as const).map(tier => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `ActivoPOS ${NOMBRE[tier]}`,
    description: `Plan ${NOMBRE[tier]} de ActivoPOS — sistema de punto de venta e inventario para Venezuela.`,
    brand: { '@type': 'Brand', name: 'ActivoPOS' },
    offers: tier === 'gratis'
      ? { '@type': 'Offer', name: NOMBRE.gratis, price: '0.00', priceCurrency: 'USD', priceValidUntil, availability: 'https://schema.org/InStock', url }
      : CICLOS.map(c => ({
          '@type': 'Offer',
          name: `${NOMBRE[tier]} — ${CYCLE_LABEL[c]}`,
          price: WORKING_BILLING_CYCLES[tier][c].totalAmount.toFixed(2),
          priceCurrency: 'USD',
          priceValidUntil,
          availability: 'https://schema.org/InStock',
          url,
        })),
  }))
}

function Celda({ valor }: { valor: CeldaComparativa }) {
  if (typeof valor === 'string') return <span className={v.valor}>{valor}</span>
  return valor
    ? <><Check size={16} className={v.si} aria-hidden="true" /><span className={v.solo}>Incluido</span></>
    : <><Minus size={16} className={v.no} aria-hidden="true" /><span className={v.solo}>No incluido</span></>
}

export default function PlanesV2({ bcvRate }: { bcvRate: number }) {
  const tarjetas: TarjetaPlan[] = [
    { tier: 'gratis',         nombre: NOMBRE.gratis,         destacado: false, features: featuresForTier('gratis'), ciclos: null },
    { tier: 'negocio_activo', nombre: NOMBRE.negocio_activo, destacado: false, features: NEGOCIO_HIGHLIGHTS,        ciclos: WORKING_BILLING_CYCLES.negocio_activo },
    { tier: 'operacion',      nombre: NOMBRE.operacion,      destacado: true,  features: OPERACION_HIGHLIGHTS,      ciclos: WORKING_BILLING_CYCLES.operacion },
  ]
  const grupos = comparativaPorCategoria()

  return (
    <div className={base.page} data-testid="planes-v2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildProductJsonLd()) }} />

      <MarketingHero icon={Tag} maxWidth={1100} className={base.hero}>
        <div className={base.container}>
          <h1 className={base.title}>Planes claros. Precios reales.</h1>
          <p className={base.subtitle}>
            Todos los planes en dólares, sin contrato. Elige el período que prefieras: el precio que ves es el que pagas.
          </p>
        </div>
      </MarketingHero>

      <section className={base.toggleSection}>
        <div className={base.container}>
          <PlanesEscalera tarjetas={tarjetas} bcvRate={bcvRate} waBase={WA_BASE} />
        </div>
      </section>

      <section className={v.instalacion} aria-label="Instalación">
        <div className={base.container}>
          <div className={v.instalacionCard}>
            <div>
              <h2 className={v.instalacionTitulo}>Instalación y puesta en marcha</h2>
              <p className={v.instalacionTexto}>Te dejamos el sistema funcionando: instalación y configuración inicial a la medida de tu negocio.</p>
            </div>
            <span className={v.instalacionPrecio} data-testid="instalacion-precio">desde {usd(INSTALACION_DESDE_USD)}</span>
          </div>
        </div>
      </section>

      <section className={v.tablaSeccion} aria-label="Comparativa de planes">
        <div className={base.container}>
          <h2 className={v.tituloSeccion}>Compara cada plan, categoría por categoría</h2>
          <div className={v.tablaWrap}>
            <table className={v.tabla} data-testid="planes-tabla">
              <caption>Comparativa de planes por categoría</caption>
              <thead>
                <tr>
                  <th scope="col">Función</th>
                  <th scope="col">{NOMBRE.gratis}</th>
                  <th scope="col">{NOMBRE.negocio_activo}</th>
                  <th scope="col">{NOMBRE.operacion}</th>
                </tr>
              </thead>
              {grupos.map(g => (
                <tbody key={g.key} data-testid={`grupo-${g.key}`}>
                  <tr className={v.grupo}><th scope="rowgroup" colSpan={4}>{g.label}</th></tr>
                  {g.rows.map(r => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td><Celda valor={r.gratis} /></td>
                      <td><Celda valor={r.entrada} /></td>
                      <td><Celda valor={r.operacion} /></td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <section className={base.faqSection}>
        <div className={base.container}>
          <h2 className={base.sectionTitle}>Preguntas frecuentes</h2>
          <div className={base.faqGrid}>
            {FAQS.map(faq => (
              <div key={faq.q} className={base.faqItem}>
                <h3 className={base.faqQ}>{faq.q}</h3>
                <p className={base.faqA}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={base.ctaSection}>
        <div className={base.container}>
          <h2 className={base.ctaTitle}>¿Tienes dudas sobre cuál plan elegir?</h2>
          <a href={`${WA_BASE}?text=Hola%2C+tengo+dudas+sobre+los+planes+de+ActivoPOS`} target="_blank" rel="noopener noreferrer" className={base.ctaBtn}>
            <MessageCircle size={16} aria-hidden="true" />
            Escríbenos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
