import type { Metadata } from 'next'
import {
  ChevronDown, LifeBuoy, ShoppingCart, Globe, Package, FileText,
  Users, ClipboardList, TrendingUp, BarChart3, FileSpreadsheet,
  Sparkles, Printer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import RevealSection from '@/components/marketing/shared/RevealSection'
import MarketingHero from '@/components/marketing/MarketingHero'
import styles from './ayuda.module.css'

export const metadata: Metadata = {
  title: 'Centro de Ayuda',
  description:
    'Guías paso a paso por módulo para sacarle el máximo a ActivoPOS: POS, catálogo, inventario, cotizaciones, clientes, pedidos, finanzas y reportes.',
}

const STEPS = [
  { title: 'Crea tu cuenta',       desc: 'Regístrate en activopos.com. Sin tarjeta, empieza gratis.' },
  { title: 'Configura tu negocio', desc: 'Logo, nombre, métodos de pago y datos de cobro en Configuración.' },
  { title: 'Agrega tus productos', desc: 'Importa desde Excel o crea uno a uno. Precio en USD, el sistema convierte a Bs.' },
  { title: 'Empieza a vender',     desc: 'Abre la caja, busca el producto, cobra. Así de simple.' },
]

const GUIDES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: ShoppingCart,    title: 'Punto de Venta',    desc: 'Escáner de cámara, multi-ticket, pago mixto, crédito y descuento con PIN.' },
  { icon: Globe,           title: 'Catálogo Digital',  desc: 'Activa tu catálogo, compártelo por QR y recibe pedidos por WhatsApp.' },
  { icon: Package,         title: 'Inventario',        desc: 'Entradas de stock, consumo interno e historial de movimientos.' },
  { icon: FileText,        title: 'Cotizaciones',      desc: 'Crea, envía por WhatsApp y convierte a venta con un clic.' },
  { icon: Users,           title: 'Clientes',          desc: 'Directorio, cuentas por cobrar y envío de datos de cobro.' },
  { icon: ClipboardList,   title: 'Pedidos',           desc: 'Kanban de estados, notificación por WhatsApp y cobro desde el tablero.' },
  { icon: TrendingUp,      title: 'Finanzas',          desc: 'Punto de equilibrio, P&L, gastos y cuentas por cobrar y pagar.' },
  { icon: BarChart3,       title: 'Reportes',          desc: 'Reporte del día, exportación a Excel y PDF, y reporte mensual.' },
  { icon: FileSpreadsheet, title: 'Importación Excel', desc: 'Descarga la plantilla, llénala e importa hasta 1000 productos.' },
  { icon: Sparkles,        title: 'Tu Día',            desc: 'Narrativa diaria con IA, producto estrella y alertas de cobro.' },
  { icon: Printer,         title: 'Impresora térmica', desc: 'Configura 58 mm u 80 mm en Configuración → Impresión.' },
]

const FAQS = [
  { q: '¿Necesito internet?',            a: 'Sí, para sincronizar tus datos y procesar ventas.' },
  { q: '¿Reemplaza el SENIAT?',          a: 'No. Controla ventas e inventario, pero no emite facturas fiscales: lo complementa.' },
  { q: '¿Funciona con pistola lectora?', a: 'Sí, cualquier lectora USB funciona plug & play.' },
  { q: '¿Puedo importar desde Excel?',   a: 'Sí, hasta 1000 productos por archivo con la plantilla oficial.' },
  { q: '¿El catálogo requiere app?',     a: 'No. Es una página web pública, tus clientes la abren desde cualquier navegador.' },
]

const SOPORTE_WA = 'https://wa.me/584243244788'

export default function AyudaPage() {
  return (
    <section className={styles.page}>
      <MarketingHero icon={LifeBuoy} maxWidth={960} className={styles.heroTop}>
        <p className={styles.eyebrow}>Centro de ayuda</p>
        <h1 className={styles.title}>¿En qué te ayudamos?</h1>
        <p className={styles.subtitle}>
          Guías paso a paso para sacarle el máximo a ActivoPOS.
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

        {/* Guías por módulo */}
        <RevealSection>
          <div className={`${styles.section} ${styles.sectionB}`}>
            <h2 className={styles.sectionTitle}>Guías por módulo</h2>
            <div className={styles.guidesGrid}>
              {GUIDES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className={styles.guideCard}>
                  <span className={styles.guideIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <p className={styles.guideTitle}>{title}</p>
                  <p className={styles.guideDesc}>{desc}</p>
                </div>
              ))}
            </div>
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
              <p className={styles.ctaSubtext}>Escríbenos y te ayudamos personalmente.</p>
            </div>
            <a
              href={SOPORTE_WA}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaBtn}
            >
              Contactar soporte por WhatsApp →
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

/* ── FAQ Item (server component con details/summary) ── */
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
