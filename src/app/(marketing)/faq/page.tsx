import type { Metadata } from 'next'
import { ChevronDown, MessageCircle, HelpCircle } from 'lucide-react'
import RevealSection from '@/components/marketing/shared/RevealSection'
import MarketingHero from '@/components/marketing/MarketingHero'
import { WA_BASE } from '@/lib/marketing-contact'
import styles from './faq.module.css'

/* ─────────────────────────────────────────────────────────
   Metadata
───────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes — POS Venezuela',
  description:
    'Resuelve tus dudas antes de empezar. ¿Reemplaza el SENIAT? ¿Funciona sin internet? ¿Cuánto cuesta? Todo sobre ActivoPOS en una sola página.',
  alternates: {
    canonical: 'https://activopos.com/faq',
  },
  openGraph: {
    title: 'FAQ — Preguntas Frecuentes | ActivoPOS',
    description:
      'Resuelve tus dudas antes de empezar. Todo sobre ActivoPOS en una sola página.',
    url: 'https://activopos.com/faq',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}

/* ─────────────────────────────────────────────────────────
   FAQ data — pre-venta / decisión de compra
   (sin solapamiento con /ayuda — esas son guías operativas)
───────────────────────────────────────────────────────── */

const CATEGORIES = [
  {
    label: 'Antes de empezar',
    items: [
      {
        q: '¿ActivoPOS reemplaza la facturación SENIAT?',
        a: 'No. ActivoPOS es tu sistema de control de ventas e inventario. La facturación fiscal ante el SENIAT la sigues haciendo con tu sistema actual — ActivoPOS la complementa, no la reemplaza.',
      },
      {
        q: '¿Necesito instalar algo?',
        a: 'No. ActivoPOS corre en el navegador desde cualquier dispositivo — celular, tablet o computadora. Nada que descargar, nada que instalar.',
      },
      {
        q: '¿Funciona sin internet?',
        a: 'El sistema requiere conexión para sincronizar datos. En zonas con cortes frecuentes recomendamos tener datos móviles como respaldo. La app está optimizada para conexiones lentas.',
      },
      {
        q: '¿Desde qué dispositivo puedo usarlo?',
        a: 'Desde cualquiera. El POS está optimizado para tablet y desktop en el mostrador. Las consultas, reportes y catálogo funcionan perfectamente desde el celular.',
      },
    ],
  },
  {
    label: 'El sistema',
    items: [
      {
        q: '¿Cómo funciona el BCV automático?',
        a: 'ActivoPOS consulta la tasa oficial BCV cada vez que abres caja. Cada venta congela la tasa del momento — el historial siempre queda en USD con el equivalente exacto en Bs al momento de la transacción.',
      },
      {
        q: '¿Puedo vender en bolívares y en dólares al mismo tiempo?',
        a: 'Sí. Cada producto muestra precio en USD y Bs simultáneamente, sin toggle. El cajero ve los dos valores en pantalla. El ticket imprime los dos.',
      },
      {
        q: '¿Qué pasa con los precios si sube el dólar?',
        a: 'Nada que tengas que hacer tú. El precio base está en USD. La conversión a Bs se recalcula automáticamente con la tasa BCV actual. Cierras el día con los números correctos sin tocar nada.',
      },
      {
        q: '¿Puedo tener varios cajeros con accesos distintos?',
        a: 'Sí. Cada cajero tiene su PIN. Los descuentos requieren PIN de autorización. El sistema registra quién hizo cada venta y en qué turno.',
      },
    ],
  },
  {
    label: 'Planes y soporte',
    items: [
      {
        q: '¿Cuánto cuesta ActivoPOS?',
        a: 'Tenemos dos planes con precios públicos: Gratis para siempre (hasta 40 productos y 1 usuario, sin tarjeta) y Negocio Activo por $19/mes (productos ilimitados, hasta 10 usuarios, catálogo digital, finanzas y todo el sistema). Los ciclos trimestral, semestral y anual tienen descuento. Mira el detalle y elige en la página de Planes.',
      },
      {
        q: '¿Hay período de prueba?',
        a: 'No hace falta: el plan Gratis es permanente y sin tarjeta. Empieza a vender hoy y sube a Negocio Activo cuando lo necesites. Si quieres una demo guiada, escríbenos por WhatsApp.',
      },
      {
        q: '¿Qué pasa si cancelo?',
        a: 'Tus datos permanecen disponibles por un período de gracia después de cancelar. No hay contratos anuales obligatorios — la relación es mes a mes.',
      },
      {
        q: '¿Tienen soporte en Venezuela?',
        a: 'Sí. Soporte directo por WhatsApp, en español venezolano, respondemos en menos de 24 horas hábiles. No hay tickets, no hay bots — una persona real.',
      },
    ],
  },
]

/* ─────────────────────────────────────────────────────────
   JSON-LD — FAQPage schema (activa rich snippets en Google)
───────────────────────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: CATEGORIES.flatMap(cat =>
    cat.items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    }))
  ),
}

/* ─────────────────────────────────────────────────────────
   Page — Server Component
───────────────────────────────────────────────────────── */

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <MarketingHero icon={HelpCircle} maxWidth={760} className={styles.hero}>
        <span className={styles.pill}>FAQ</span>
        <h1 className={styles.h1}>
          Todo lo que necesitas saber antes de empezar.
        </h1>
        <p className={styles.sub}>Sin tecnicismos. Sin letra pequeña. En venezolano.</p>
      </MarketingHero>

      {/* Categories + accordions */}
      <div className={styles.body}>
        {CATEGORIES.map(cat => (
          <RevealSection key={cat.label}>
            <div className={styles.category}>
              <p className={styles.catLabel}>{cat.label}</p>

              <div className={styles.grid} role="list">
                {cat.items.map(({ q, a }) => (
                  <details key={q} className={styles.item} role="listitem">
                    <summary className={styles.summary}>
                      <span className={styles.question}>{q}</span>
                      <ChevronDown
                        size={16}
                        className={styles.chevron}
                        aria-hidden="true"
                      />
                    </summary>
                    <p className={styles.answer}>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </RevealSection>
        ))}

        {/* CTA final */}
        <RevealSection>
          <aside className={styles.cta} aria-label="¿Más preguntas?">
            <div className={styles.ctaContent}>
              <p className={styles.ctaTitle}>¿Tu pregunta no está aquí?</p>
              <p className={styles.ctaDesc}>
                Respondemos en menos de 24 horas — una persona real, sin bots.
              </p>
            </div>
            <a
              href={`${WA_BASE}?text=Tengo%20una%20pregunta%20sobre%20ActivoPOS`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaBtn}
              aria-label="Escribirnos por WhatsApp"
            >
              <MessageCircle size={16} aria-hidden="true" />
              Escríbenos por WhatsApp
            </a>
          </aside>
        </RevealSection>
      </div>
    </>
  )
}
