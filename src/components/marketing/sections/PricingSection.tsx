import { MessageCircle, Zap, Globe, Check } from 'lucide-react'
import styles from './PricingSection.module.css'

const WA_BASE = 'https://wa.me/584222654827'

const PLANS = [
  {
    tier: 'Plan 1',
    name: 'Mostrador\nactivado',
    riskFree: 'Empieza donde estás. Sin riesgo.',
    tagline: 'Deja el papel hoy mismo',
    taglineIcon: Zap,
    desc: 'Para el negocio que quiere control real desde el primer día. Ventas, inventario, variantes y caja — todo en una sola pantalla.',
    feats: [
      'POS táctil completo',
      'Variantes: peso, talla, color, medida, tiempo',
      'Módulo Fábrica: combos y productos con receta',
      'Cotizaciones y devoluciones integradas',
      'Inventario con alertas de stock bajo',
      'BCV + paralelo + USDT automático',
      'Pago Móvil, Zelle, Efectivo, USDT',
      'Tickets térmicos 58mm · 80mm · carta',
    ],
    cta: 'Consultar por WhatsApp',
    wa: `${WA_BASE}?text=Hola%2C+me+interesa+el+plan+Mostrador+de+ActivoPOS`,
    featured: false,
    badge: null,
  },
  {
    tier: 'Plan 2',
    name: 'Catálogo\nen la calle',
    riskFree: 'Para el negocio que ya vende y quiere vender más.',
    tagline: 'Tu negocio abierto 24/7',
    taglineIcon: Globe,
    desc: 'El POS completo más tu vitrina digital que recibe pedidos por WhatsApp con delivery mientras tú duermes. Tu QR propio para compartir donde quieras.',
    feats: [
      'Todo lo del plan Mostrador',
      'Vitrina web tutienda.activopos.com',
      'Inventario sincronizado en tiempo real',
      'Pedidos y delivery por WhatsApp',
      'Kanban de pedidos: recibido → listo → despachado',
      'QR propio para imprimir, compartir o publicar',
      'Múltiples cajeros con roles diferenciados',
      'Notificaciones push de stock bajo',
    ],
    cta: 'Activar mi catálogo',
    wa: `${WA_BASE}?text=Hola%2C+me+interesa+el+plan+Cat%C3%A1logo+de+ActivoPOS`,
    featured: true,
    badge: 'Más popular',
  },
] as const

export default function PricingSection() {
  return (
    <section className={styles.section} id="pricing">
      <div className={styles.container}>
        <div className={styles.head}>
          <h2 className={styles.title} data-reveal>
            Empieza donde estás.<br />Escala cuando quieras.
          </h2>
          <p className={styles.subtitle} data-reveal>
            Escríbenos y te explicamos todo en menos de 24 horas.
            Sin contratos anuales, sin letras pequeñas.
          </p>
        </div>

        <div className={styles.grid} data-reveal>
          {PLANS.map(({ tier, name, riskFree, tagline, taglineIcon: TIcon, desc, feats, cta, wa, featured, badge }) => (
            <div key={tier} className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
              {badge && <div className={styles.badge}>{badge}</div>}
              <div className={styles.cardHead}>
                <div className={styles.cardTier}>{tier}</div>
                <div className={styles.cardName}>
                  {name.split('\n').map((line, i) => (
                    <span key={i}>{line}{i === 0 && <br />}</span>
                  ))}
                </div>
                <p className={styles.riskFree}>{riskFree}</p>
                <div className={styles.tagline}>
                  <TIcon size={12} aria-hidden />
                  {tagline}
                </div>
                <p className={styles.cardDesc}>{desc}</p>
              </div>
              <div className={styles.divider} />
              <ul className={styles.feats}>
                {feats.map((f) => (
                  <li key={f}>
                    <Check size={13} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.ctaBtn} ${featured ? styles.ctaBtnFeatured : ''}`}
              >
                <MessageCircle size={14} aria-hidden />
                {cta}
              </a>
            </div>
          ))}
        </div>

        <p className={styles.note} data-reveal>
          ¿Tienes un sportbar, estadio o venue?{' '}
          <a
            href={`${WA_BASE}?text=Hola%2C+tengo+un+venue+y+quiero+info+de+ActivoPOS`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Hablemos directamente →
          </a>
        </p>
      </div>
    </section>
  )
}
