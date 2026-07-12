import Link from 'next/link'
import { Check } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import styles from './SegmentPricing.module.css'

interface Props {
  bcvRate: number
}

const TIERS: Exclude<PlanTier, 'trial'>[] = ['inicio', 'pro', 'business']

const PLAN_FEATS: Record<Exclude<PlanTier, 'trial'>, string[]> = {
  inicio: [
    'POS táctil en cualquier pantalla',
    'BCV automático en cada venta',
    'Hasta 3 usuarios',
    'Hasta 100 productos',
  ],
  pro: [
    'Todo lo de Mostrador',
    'Catálogo digital con pedidos por WhatsApp',
    'Cotizaciones en PDF',
    'Cuentas por cobrar y finanzas completas',
    'Hasta 10 usuarios',
    'Hasta 500 productos',
  ],
  business: [
    'Todo lo de Negocio',
    'Analytics avanzado',
    'Usuarios y productos ilimitados',
    'Panel de cocina (KDS)',
    'Soporte prioritario',
  ],
}

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
            const popular = tier === 'pro'
            const monthlyUsd = BILLING_CYCLES[tier].mensual.monthlyEquivalent
            return (
              <article key={tier} className={`${styles.card} ${popular ? styles.cardPopular : ''}`}>
                {popular && <span className={styles.popularBadge}>Más popular</span>}
                <h3 className={styles.planName}>{PLAN_DISPLAY[tier]}</h3>
                <div className={styles.priceRow}>
                  <span className={styles.price}>{fmtMoney(monthlyUsd)}</span>
                  <span className={styles.per}>/ mes</span>
                </div>
                <p className={styles.planDesc}>Bs. {fmtBs(monthlyUsd, bcvRate)} al mes</p>
                <ul className={styles.features}>
                  {PLAN_FEATS[tier].map(f => (
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
