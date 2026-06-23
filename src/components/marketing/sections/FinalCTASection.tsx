import { MessageCircle, CheckCircle } from 'lucide-react'
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
          Un mensaje y en menos de 24 horas tienes la demo lista.
          Sin instalar nada. Sin compromisos.
        </p>
        <div className={styles.ctaWrap} data-reveal>
          <a
            href="https://wa.me/584222654827?text=Hola%2C+quiero+activar+mi+negocio+con+ActivoPOS"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaBtn}
          >
            <MessageCircle size={20} aria-hidden />
            Escríbenos por WhatsApp
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
