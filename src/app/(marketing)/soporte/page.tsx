import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown, LifeBuoy } from 'lucide-react'
import AyudaTabs from './AyudaTabs'
import RevealSection from '@/components/marketing/shared/RevealSection'
import MarketingHero from '@/components/marketing/MarketingHero'
import styles from './ayuda.module.css'

export const metadata: Metadata = {
  title: 'Centro de Ayuda',
  description:
    'Primeros pasos con ActivoPOS, guías por tipo de negocio y respuestas a las preguntas más frecuentes.',
}

const STEPS = [
  { title: 'Crea tu cuenta',      desc: 'Regístrate con tu correo en activopos.com. Sin tarjeta de crédito — empieza gratis.' },
  { title: 'Configura tu negocio', desc: 'Sube tu logo, define el nombre y elige los módulos activos: POS, catálogo, pedidos.' },
  { title: 'Agrega productos',     desc: 'Importa desde Excel o crea uno a uno. Precio en USD, el sistema convierte a Bs automáticamente.' },
  { title: 'Empieza a vender',     desc: 'Abre la caja, elige el producto, confirma la cantidad y cobra. Así de simple.' },
]

const FAQS = [
  {
    q: '¿Necesito internet para usar el POS?',
    a: 'El POS requiere conexión para procesar ventas y sincronizar stock. Estamos desarrollando un modo offline básico para zonas con conectividad intermitente.',
  },
  {
    q: '¿ActivoPOS reemplaza mi facturación SENIAT?',
    a: 'No. ActivoPOS controla ventas e inventario, pero no emite facturas fiscales. Es complementario a tu sistema de facturación actual.',
  },
  {
    q: '¿Cómo se maneja el tipo de cambio?',
    a: 'El sistema consulta automáticamente la tasa BCV a través de la API oficial. Todos los precios se muestran en USD y en Bs simultáneamente, nunca con un solo signo.',
  },
  {
    q: '¿Puedo tener varios cajeros?',
    a: 'Sí. Puedes crear usuarios con rol de Cajero. Tienen acceso al POS, caja y clientes, sin ver costos ni configuración del negocio.',
  },
  {
    q: '¿El catálogo digital tiene costo aparte?',
    a: 'No es un costo aparte: viene incluido en el plan Negocio Activo. Tu negocio tiene su propio URL público donde los clientes ven los productos y hacen pedidos por WhatsApp. El plan Gratis se enfoca en el POS y el inventario.',
  },
  {
    q: '¿Qué pasa si cancelo mi suscripción?',
    a: 'Tienes 30 días para exportar tus datos. Pasado ese período, los datos se eliminan permanentemente de nuestros servidores.',
  },
]

export default function AyudaPage() {
  return (
    <section className={styles.page}>
      <MarketingHero icon={LifeBuoy} maxWidth={960} className={styles.heroTop}>
        <p className={styles.eyebrow}>Centro de ayuda</p>
        <h1 className={styles.title}>¿En qué te ayudamos?</h1>
        <p className={styles.subtitle}>
          Guías paso a paso, recursos por tipo de negocio y respuestas rápidas
          a las preguntas más comunes.
        </p>
      </MarketingHero>

      <div className={styles.inner}>
        {/* Primeros pasos */}
        <RevealSection>
          <div className={`${styles.section} ${styles.sectionA}`}>
            <h2 className={styles.sectionTitle}>Primeros pasos</h2>
            <div className={styles.stepsGrid}>
              {STEPS.map(({ title, desc }, i) => (
                <div key={title} className={styles.step}>
                  <p className={styles.stepNum} aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
                  <p className={styles.stepTitle}>{title}</p>
                  <p className={styles.stepDesc}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* Por negocio (tabs) */}
        <RevealSection>
          <div className={`${styles.section} ${styles.sectionB}`}>
            <h2 className={styles.sectionTitle}>Por tipo de negocio</h2>
            <AyudaTabs />
          </div>
        </RevealSection>

        {/* FAQ */}
        <RevealSection>
          <div className={`${styles.section} ${styles.sectionA}`}>
            <h2 className={styles.sectionTitle}>Preguntas frecuentes</h2>
            <div className={styles.faqList}>
              {FAQS.map(({ q, a }) => (
                <FaqItem key={q} question={q} answer={a} />
              ))}
            </div>
          </div>
        </RevealSection>

        {/* CTA */}
        <RevealSection>
          <div className={styles.ctaBlock}>
            <div>
              <p className={styles.ctaText}>¿No encontraste lo que buscabas?</p>
              <p className={styles.ctaSubtext}>Responderemos en menos de 24 horas.</p>
            </div>
            <Link href="/contacto" className={styles.ctaBtn}>
              Contactar soporte →
            </Link>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

/* ── FAQ Item (server component with details/summary) ── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className={styles.faqItem}>
      <summary className={styles.faqQ}>
        <span className={styles.faqQText}>{question}</span>
        <ChevronDown size={16} className={styles.faqChevron} aria-hidden="true" />
      </summary>
      <p className={styles.faqA}>{answer}</p>
    </details>
  )
}
