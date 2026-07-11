import { RefreshCw, TrendingUp, Clock3, Receipt } from 'lucide-react'
import styles from './FinancialBrainSection.module.css'

interface Props {
  bcvRate: number
}

function fmtRate(rate: number): string {
  if (!rate) return '...'
  return rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function FinancialBrainSection({ bcvRate }: Props) {
  const rateDisplay  = fmtRate(bcvRate)
  const ventaMesUsd  = 6280.4
  const porCobrarUsd = 340.0

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.copy}>
          <h2 className={styles.title}>Tu negocio te dice, en criollo, cómo vas.</h2>
          <p className={styles.subtitle}>
            La tasa BCV se actualiza sola y se congela en cada venta. Tú vendes, el sistema calcula —
            en USD, con el equivalente en bolívares siempre a la vista.
          </p>
          <div className={styles.bcvPill}>
            <RefreshCw size={13} aria-hidden="true" />
            BCV Bs. {rateDisplay} · actualizado automáticamente
          </div>
        </div>

        <div className={styles.brain}>
          <div className={styles.monthCard}>
            <span className={styles.monthLabel}>Tu mes</span>
            <div className={styles.monthTotal}>
              <span className={styles.monthUsd}>${ventaMesUsd.toFixed(2)}</span>
              <span className={styles.monthBs}>Bs.&nbsp;{fmtBs(ventaMesUsd, bcvRate)}</span>
            </div>
            <span className={styles.monthSub}>Vendido este mes</span>
          </div>

          <div className={styles.confirmCard}>
            <TrendingUp size={16} aria-hidden="true" />
            Ya cubriste lo que gastaste este mes
          </div>

          <div className={styles.miniRow}>
            <div className={styles.miniCard}>
              <span className={styles.miniIcon}><Receipt size={15} aria-hidden="true" /></span>
              <span className={styles.miniLabel}>Lo que te deben</span>
              <span className={styles.miniValue}>${porCobrarUsd.toFixed(2)}</span>
            </div>
            <div className={styles.miniCard}>
              <span className={styles.miniIcon}><Clock3 size={15} aria-hidden="true" /></span>
              <span className={styles.miniLabel}>Tu mejor hora</span>
              <span className={styles.miniValue}>6:00 PM · viernes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
