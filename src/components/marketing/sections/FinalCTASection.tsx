import Link from 'next/link'
import { Store, UserPlus, CheckCircle } from 'lucide-react'
import FeatureMarquee from './FeatureMarquee'
import styles from './FinalCTASection.module.css'

const TRUST = [
  'Sin contrato anual',
  'BCV nativo incluido',
  'Variantes sin costo extra',
  'Soporte en español',
]

export default function FinalCTASection() {
  return (
    <section className={styles.section} id="final">
      {/* Curva de transición navy-2 (Testimonios) → navy (base, esta sección) —
          antes tenía fill var(--mkt-bg) (claro), un resto de cuando Testimonios
          no era navy; con las 3 zonas ahora en tonos de navy distintos, el
          fill debe ser el tono de la sección de ARRIBA para que la curva
          se lea como costura entre ambas, no como un parche claro suelto. */}
      <svg className={styles.curve} viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,110 C480,0 960,0 1440,110 L1440,0 L0,0 Z" fill="var(--mkt-navy-2)" />
      </svg>
      <FeatureMarquee />
      <div className={styles.content}>
        <h2 className={styles.title} data-reveal>
          Tu negocio está activo.{' '}
          <em>Tu sistema también debería estarlo.</em>
        </h2>
        <p className={styles.subtitle} data-reveal>
          Empieza gratis hoy. Sin tarjeta de crédito.
        </p>
        <div className={styles.ctaWrap} data-reveal>
          <Link href="/registro" className={styles.ctaBtn}>
            <UserPlus size={20} aria-hidden />
            Empezar gratis
          </Link>
          <Link href="/catalogo/multi-demo" className={styles.ctaBtnGhost}>
            <Store size={18} aria-hidden />
            Ver catálogo en vivo
          </Link>
        </div>
        <div className={styles.trust} data-reveal>
          {TRUST.map((item) => (
            <span key={item} className={styles.trustItem}>
              <CheckCircle size={13} aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
