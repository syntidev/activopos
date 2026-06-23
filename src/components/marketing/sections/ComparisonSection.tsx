import { XCircle, CheckCircle, X, Check } from 'lucide-react'
import styles from './ComparisonSection.module.css'

const WITHOUT = [
  'Ventas anotadas en cuaderno o Excel',
  'BCV calculado a mano cada día',
  'Sin especificaciones por producto',
  'WhatsApps con precios uno a uno',
  'Cotizaciones de servicios en papel',
  'Sin Pago Móvil ni USDT nativo',
]

const WITH = [
  'Cada venta registrada al instante en USD y Bs',
  'BCV actualizado automáticamente, siempre',
  'Variantes flexibles: talla, peso, color, medida',
  'Catálogo activo 24/7 con pedidos por WhatsApp',
  'Cotizaciones digitales con mano de obra',
  'Pago Móvil, Zelle, Efectivo, USDT',
]

export default function ComparisonSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.copy}>
          <h2 className={styles.title} data-reveal>
            Un sistema que trabaje<br />como trabaja tu negocio.
          </h2>
          <div className={styles.callout} data-reveal>
            <p>
              Si el cuaderno te ayuda a <strong>contar la plata al final del día</strong>,<br />
              ActivoPOS te ayuda a <strong>multiplicarla mientras el día ocurre.</strong>
            </p>
          </div>
        </div>

        <div className={styles.grid} data-reveal>
          {/* Without */}
          <div className={styles.col}>
            <div className={`${styles.head} ${styles.headBad}`}>
              <XCircle size={13} aria-hidden />
              Sin ActivoPOS
            </div>
            {WITHOUT.map((item) => (
              <div key={item} className={`${styles.row} ${styles.rowBad}`}>
                <X size={13} aria-hidden />
                {item}
              </div>
            ))}
          </div>

          {/* With */}
          <div className={styles.col}>
            <div className={`${styles.head} ${styles.headGood}`}>
              <CheckCircle size={13} aria-hidden />
              Con ActivoPOS
            </div>
            {WITH.map((item) => (
              <div key={item} className={`${styles.row} ${styles.rowGood}`}>
                <Check size={13} aria-hidden />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
