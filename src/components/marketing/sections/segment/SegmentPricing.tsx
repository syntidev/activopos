import Link from 'next/link'
import { Check } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import { featuresForTier } from '@/lib/plan-features'
import styles from './SegmentPricing.module.css'

interface Props {
  bcvRate: number
}

const TIERS: PlanTier[] = ['gratis', 'negocio_activo']

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SegmentPricing({ bcvRate }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Un precio claro. Sin sorpresas.</h2>
        <p className={styles.subtitle}>Todos los planes en dólares. Sin contratos anuales.</p>
        <div className={styles.grid}>
          {TIERS.map(tier => {
            const popular = tier === 'negocio_activo'
            const amounts = tier === 'gratis' ? null : BILLING_CYCLES[tier].mensual
            const feats   = featuresForTier(tier)
            return (
              <article key={tier} className={`${styles.card} ${popular ? styles.cardPopular : ''}`}>
                {popular && <span className={styles.popularBadge}>Todo incluido</span>}
                <h3 className={styles.planName}>{PLAN_DISPLAY[tier]}</h3>
                <div className={styles.priceRow}>
                  <span className={styles.price}>{amounts ? fmtMoney(amounts.monthlyEquivalent) : 'Gratis'}</span>
                  {amounts && <span className={styles.per}>/ mes</span>}
                </div>
                <p className={styles.planDesc}>
                  {!amounts
                    ? 'Para siempre, sin tarjeta'
                    : bcvRate > 0 ? `Bs. ${fmtBs(amounts.monthlyEquivalent, bcvRate)} al mes` : 'Precio en USD'}
                </p>
                <ul className={styles.features}>
                  {feats.map(f => (
                    <li key={f} className={styles.feature}>
                      <Check size={16} strokeWidth={2.5} className={styles.check} aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/registro?plan=${tier}`}
                  className={`${styles.planBtn} ${popular ? styles.planBtnFilled : styles.planBtnOutline}`}
                >
                  Empezar con {PLAN_DISPLAY[tier]}
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
