'use client'

import { useState } from 'react'
import { Check, MessageCircle } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier, type BillingCycleKey } from '@/lib/plan-limits'
import styles from './PricingSection.module.css'

interface Props {
  bcvRate: number
}

const WA_BASE = 'https://wa.me/584222654827'

const CYCLE_ORDER: BillingCycleKey[] = ['mensual', 'semestral', 'anual']

const CYCLE_LABEL: Record<BillingCycleKey, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

interface PlanCopy {
  tier:     Exclude<PlanTier, 'trial'>
  feats:    string[]
  featured: boolean
  badge:    string | null
}

const PLANS: PlanCopy[] = [
  {
    tier: 'inicio',
    feats: [
      'POS táctil en cualquier pantalla',
      'BCV automático en cada venta',
      'Hasta 3 usuarios',
      'Hasta 100 productos',
    ],
    featured: false,
    badge: null,
  },
  {
    tier: 'pro',
    feats: [
      'Todo lo de Mostrador',
      'Catálogo digital con pedidos por WhatsApp',
      'Cotizaciones en PDF',
      'Cuentas por cobrar y finanzas completas',
      'Hasta 10 usuarios',
      'Hasta 500 productos',
    ],
    featured: true,
    badge: 'Más popular',
  },
  {
    tier: 'business',
    feats: [
      'Todo lo de Negocio',
      'Analytics avanzado',
      'Usuarios y productos ilimitados',
      'Panel de cocina (KDS)',
      'Soporte prioritario',
    ],
    featured: false,
    badge: null,
  },
]

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PricingSection({ bcvRate }: Props) {
  const [cycle, setCycle] = useState<BillingCycleKey>('mensual')

  return (
    <section className={styles.section} id="precios">
      <div className={styles.container}>
        <div className={styles.head}>
          <h2 className={styles.title}>Un plan para cada etapa de tu negocio.</h2>
          <p className={styles.subtitle}>Sin contrato anual. Cambias de plan cuando quieras.</p>
        </div>

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
          {PLANS.map(({ tier, feats, featured, badge }) => {
            const amounts    = BILLING_CYCLES[tier][cycle]
            const hasSavings = amounts.savingsAmount > 0
            const waMsg       = encodeURIComponent(`Hola, me interesa el plan ${PLAN_DISPLAY[tier]} de ActivoPOS`)
            return (
              <div key={tier} className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
                {badge && <span className={styles.badge}>{badge}</span>}
                <span className={styles.planName}>{PLAN_DISPLAY[tier]}</span>
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
                <ul className={styles.feats}>
                  {feats.map(f => (
                    <li key={f}><Check size={14} aria-hidden="true" />{f}</li>
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
      </div>
    </section>
  )
}
