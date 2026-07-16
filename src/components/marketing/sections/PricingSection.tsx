'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Check, MessageCircle, ArrowRight } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier, type BillingCycleKey } from '@/lib/plan-limits'
import { featuresForTier, exclusiveFeaturesForTier } from '@/lib/plan-features'
import { WA_BASE } from '@/lib/marketing-contact'
import { PAYMENT_METHODS } from '@/components/marketing/shared/payment-methods'
import styles from './PricingSection.module.css'

interface Props {
  bcvRate: number
  /* Reuso en /planes: ese page ya tiene hero propio + link circular
     no aplica. Ambos default true -> home sin cambios. */
  showHeader?: boolean
  showMoreLink?: boolean
}

const CYCLE_ORDER: BillingCycleKey[] = ['mensual', 'semestral', 'anual']

const CYCLE_LABEL: Record<BillingCycleKey, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

interface PlanCopy {
  tier:          Exclude<PlanTier, 'trial'>
  featured:      boolean
  badge:         string | null
  inheritsFrom:  string | null
}

const PLANS: PlanCopy[] = [
  { tier: 'inicio',   featured: false, badge: null,              inheritsFrom: null },
  { tier: 'pro',      featured: true,  badge: 'Más popular',     inheritsFrom: 'Todo lo de Mostrador, más:' },
  { tier: 'business', featured: false, badge: null,              inheritsFrom: 'Todo lo de Negocio, más:' },
]

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PricingSection({ bcvRate, showHeader = true, showMoreLink = true }: Props) {
  const [cycle, setCycle] = useState<BillingCycleKey>('mensual')

  return (
    <section className={styles.section} id="precios">
      <div className={styles.container}>
        {showHeader && (
          <div className={styles.head}>
            <h2 className={styles.title}>Un plan para cada etapa de tu negocio.</h2>
            <p className={styles.subtitle}>Sin contrato anual. Cambias de plan cuando quieras.</p>
          </div>
        )}

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
          {PLANS.map(({ tier, featured, badge, inheritsFrom }) => {
            const amounts    = BILLING_CYCLES[tier][cycle]
            const hasSavings = amounts.savingsAmount > 0
            const waMsg       = encodeURIComponent(`Hola, me interesa el plan ${PLAN_DISPLAY[tier]} de ActivoPOS`)
            const feats       = inheritsFrom ? exclusiveFeaturesForTier(tier) : featuresForTier(tier)
            return (
              <div key={tier} className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
                {badge && <span className={styles.badge}>{badge}</span>}
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
                {inheritsFrom && <p className={styles.inheritsFrom}>{inheritsFrom}</p>}
                <ul className={styles.feats}>
                  {feats.map(f => (
                    <li key={f.label}>
                      <Check size={14} aria-hidden="true" />
                      <span>
                        <span className={styles.featLabel}>{f.label}</span>
                        <span className={styles.featDesc}>{f.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
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

        {/* Franja de métodos de pago -- versión corta de la ex-sección
            PaymentMethodsSection, ahora dentro de Planes. Los planes,
            precios y CTAs de arriba quedan intactos. */}
        <div className={styles.paymentStrip}>
          <span className={styles.paymentStripLabel}>Cobra como ya le cobras a tu cliente:</span>
          <div className={styles.paymentPills}>
            {PAYMENT_METHODS.map(({ name, Icon, color }) => (
              <span key={name} className={styles.paymentPill}>
                <span className={styles.paymentPillIcon} style={{ '--pm-icon': color } as CSSProperties}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>

        {showMoreLink && (
          <div className={styles.moreWrap}>
            <Link href="/planes" className={styles.moreLink}>
              Ver todos los detalles
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
