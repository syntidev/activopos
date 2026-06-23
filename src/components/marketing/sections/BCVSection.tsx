import { RefreshCw, Lock } from 'lucide-react'
import styles from './BCVSection.module.css'

interface Props {
  bcvRate: number
}

function fmtRate(rate: number): string {
  if (!rate) return '—'
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BCVSection({ bcvRate }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.inner}>
          <div className={styles.copy} data-reveal data-reveal-from="left">
            <h2 className={styles.title}>
              Nunca más calcules bolívares a mano.
            </h2>
            <p className={styles.subtitle}>
              ActivoPOS actualiza la tasa BCV y la congela en cada venta. El historial
              siempre en USD, la conversión siempre exacta. Tú te concentras en vender.
            </p>
          </div>

          <div className={styles.widget} data-reveal data-reveal-from="right">
            <div className={styles.liveRow}>
              <span className={styles.liveDot} />
              BCV en vivo
            </div>
            <div className={styles.rateBig}>
              1 USD = Bs.&nbsp;<span>{fmtRate(bcvRate)}</span>
            </div>
            <div className={styles.rateSub}>
              {bcvRate ? 'Oficial BCV · actualizado automáticamente' : 'Consultando tasa oficial...'}
            </div>
            <div className={styles.pills}>
              <div className={styles.pill}>
                <RefreshCw size={10} aria-hidden />
                Actualización automática
              </div>
              <div className={styles.pill}>
                <Lock size={10} aria-hidden />
                Congelada en cada venta
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
