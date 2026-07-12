'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier, type BillingCycleKey } from '@/lib/plan-limits'
import styles from './page.module.css'

interface Props {
  bcvRate: number
}

const WA_BASE = 'https://wa.me/584222654827'

const TIERS: Exclude<PlanTier, 'trial'>[] = ['inicio', 'pro', 'business']

const CYCLE_ORDER: BillingCycleKey[] = ['mensual', 'semestral', 'anual']

const CYCLE_LABEL: Record<BillingCycleKey, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PlanToggle({ bcvRate }: Props) {
  const [cycle, setCycle] = useState<BillingCycleKey>('mensual')

  return (
    <section className={styles.toggleSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>Elige tu plan</h2>
        <div className={styles.cycleTabs} role="tablist" aria-label="Ciclo de facturación">
          {CYCLE_ORDER.map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cycle === c}
              className={`${styles.cycleTab} ${cycle === c ? styles.cycleTabOn : ''}`}
              onClick={() => setCycle(c)}
            >
              {CYCLE_LABEL[c]}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {TIERS.map(tier => {
            const amounts    = BILLING_CYCLES[tier][cycle]
            const hasSavings = amounts.savingsAmount > 0
            const featured    = tier === 'pro'
            const waMsg       = encodeURIComponent(`Hola, me interesa el plan ${PLAN_DISPLAY[tier]} de ActivoPOS`)
            return (
              <div key={tier} className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
                {featured && <span className={styles.badge}>Más popular</span>}
                <h3 className={styles.planName}>{PLAN_DISPLAY[tier]}</h3>
                <div className={styles.priceRow}>
                  <span className={styles.priceUsd}>{fmtMoney(amounts.monthlyEquivalent)}</span>
                  <span className={styles.pricePeriod}>/mes</span>
                </div>
                <span className={styles.priceBs}>Bs. {fmtBs(amounts.monthlyEquivalent, bcvRate)}</span>
                {cycle !== 'mensual' && (
                  <span className={styles.cycleNote}>
                    Total {fmtMoney(amounts.totalAmount)} · {CYCLE_LABEL[cycle].toLowerCase()}
                    {hasSavings && <> · ahorras {fmtMoney(amounts.savingsAmount)}</>}
                  </span>
                )}
                <a
                  href={`${WA_BASE}?text=${waMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={featured ? styles.ctaBtnFeatured : styles.ctaBtn}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  Empezar con {PLAN_DISPLAY[tier]}
                </a>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
