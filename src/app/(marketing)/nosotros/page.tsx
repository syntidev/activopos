import type { Metadata } from 'next'
import { Target, Eye, ExternalLink } from 'lucide-react'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './nosotros.module.css'

export const metadata: Metadata = {
  title: 'Nosotros',
  description:
    'Conoce el equipo detrás de ActivoPOS y la misión que nos mueve: democratizar el control de ventas para los negocios venezolanos.',
  alternates: {
    canonical: 'https://activopos.com/nosotros',
  },
}

const VALUES = [
  { name: 'Venezuela primero',   desc: 'Diseñado para la realidad del comercio venezolano: bolívares, dólar paralelo, cortes de luz y conectividad intermitente.' },
  { name: 'Cero fachadas',       desc: 'El código que enviamos funciona. No prometemos demos brillantes que no existen en producción.' },
  { name: 'Simplicidad activa',  desc: 'El cajero de un bodegón no necesita aprender un ERP. Si algo tarda más de 3 toques, lo rediseñamos.' },
  { name: 'Datos del negocio',   desc: 'Tus datos son tuyos. No los vendemos, no los usamos para entrenamiento, no los compartimos con terceros.' },
]

export default function NosotrosPage() {
  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <RevealSection>
          <p className={styles.eyebrow}>Quiénes somos</p>
          <h1 className={styles.title}>Construido por gente de aquí</h1>
          <p className={styles.lead}>
            ActivoPOS nació de la frustración de ver negocios venezolanos operando
            con cuadernos, hojas de cálculo o sistemas extranjeros que ignoran la
            realidad del mercado local. Somos el equipo de{' '}
            <a href="https://syntiweb.com" target="_blank" rel="noopener noreferrer" className={styles.syntiLink}>
              synti.dev
            </a>
            {' '}y construimos software que funciona aquí, ahora.
          </p>
        </RevealSection>

        {/* Misión + Visión */}
        <RevealSection>
          <div className={styles.mvGrid}>
            <div className={styles.mvCard}>
              <div className={styles.mvIcon}>
                <Target size={20} aria-hidden="true" />
              </div>
              <p className={styles.mvLabel}>Misión</p>
              <h2 className={styles.mvTitle}>Darle control real a cada negocio</h2>
              <p className={styles.mvBody}>
                Proveemos a las PYMES venezolanas herramientas de gestión de ventas e
                inventario que son simples, robustas y diseñadas para la realidad local:
                doble moneda, conectividad irregular y operación sin fricción.
              </p>
            </div>
            <div className={styles.mvCard}>
              <div className={styles.mvIcon}>
                <Eye size={20} aria-hidden="true" />
              </div>
              <p className={styles.mvLabel}>Visión</p>
              <h2 className={styles.mvTitle}>El POS de referencia en Venezuela</h2>
              <p className={styles.mvBody}>
                Que cualquier dueño de negocio en Venezuela pueda cerrar su día sabiendo
                exactamente cuánto vendió, cuánto tiene en inventario y cuánto ganó — sin
                necesitar un contador ni un técnico.
              </p>
            </div>
          </div>
        </RevealSection>

        {/* Valores */}
        <RevealSection>
          <h2 className={styles.valuesTitle}>Lo que nos guía</h2>
          <div className={styles.valuesGrid}>
            {VALUES.map(({ name, desc }, i) => (
              <div key={name} className={styles.valueItem}>
                <span className={styles.valueNum} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className={styles.valueName}>{name}</p>
                  <p className={styles.valueDesc}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* synti.dev block */}
        <RevealSection>
          <div className={styles.syntiBlock}>
            <div className={styles.syntiContent}>
              <p className={styles.syntiLabel}>Parte del ecosistema</p>
              <h3 className={styles.syntiTitle}>synti.dev</h3>
              <p className={styles.syntiDesc}>
                ActivoPOS es el primer producto del ecosistema SYNTIdev. Desarrollamos
                software para negocios venezolanos con el mismo cuidado que ponemos en
                cada línea de código: ninguna fachada, todo funciona.
              </p>
            </div>
            <a
              href="https://syntiweb.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.syntiLink}
              aria-label="Visitar synti.dev"
            >
              Visitar synti.dev
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}
