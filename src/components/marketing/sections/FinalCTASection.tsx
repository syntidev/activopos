import Link from 'next/link'
import { MessageCircle, UserPlus, CheckCircle } from 'lucide-react'
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
      <div className={styles.bg} aria-hidden />
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
          <a
            href="https://wa.me/584222654827?text=Hola%2C+quiero+activar+mi+negocio+con+ActivoPOS"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaBtnGhost}
          >
            <MessageCircle size={18} aria-hidden />
            Ver demostración
          </a>
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
