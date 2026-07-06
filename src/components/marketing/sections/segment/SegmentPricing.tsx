import Link from 'next/link'
import { Check } from 'lucide-react'
import type { PlanData } from '@/types/marketing'
import styles from './SegmentPricing.module.css'

const POPULAR_KEY = 'pro'

export default function SegmentPricing({ plans }: { plans: PlanData[] }) {
  if (plans.length === 0) return null
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Un precio claro. Sin sorpresas.</h2>
        <p className={styles.subtitle}>Todos los planes en dólares. Sin contratos anuales.</p>
        <div className={styles.grid}>
          {plans.map(plan => {
            const popular = plan.key === POPULAR_KEY
            return (
              <article key={plan.id} className={`${styles.card} ${popular ? styles.cardPopular : ''}`}>
                {popular && <span className={styles.popularBadge}>Más popular</span>}
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.priceRow}>
                  <span className={styles.price}>${plan.price_usd}</span>
                  <span className={styles.per}>/ mes</span>
                </div>
                {plan.description && <p className={styles.planDesc}>{plan.description}</p>}
                <ul className={styles.features}>
                  {plan.features.map((f, i) => (
                    <li key={i} className={styles.feature}>
                      <Check size={16} strokeWidth={2.5} className={styles.check} aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/registro?plan=${plan.key}`}
                  className={`${styles.planBtn} ${popular ? styles.planBtnFilled : styles.planBtnOutline}`}
                >
                  Empezar con {plan.name}
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
