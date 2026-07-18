'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Check, MessageCircle, ArrowRight } from 'lucide-react'
import { BILLING_CYCLES, PLAN_DISPLAY, type PlanTier, type BillingCycleKey } from '@/lib/plan-limits'
import { featuresForTier } from '@/lib/plan-features'
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

const CYCLE_ORDER: BillingCycleKey[] = ['mensual', 'trimestral', 'semestral', 'anual']

const CYCLE_LABEL: Record<BillingCycleKey, string> = {
  mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

type Currency = 'usd' | 'bs'

interface PlanCopy {
  tier:     PlanTier
  featured: boolean
  badge:    string | null
}

const PLANS: PlanCopy[] = [
  { tier: 'gratis',         featured: false, badge: null            },
  { tier: 'negocio_activo', featured: true,  badge: 'Todo incluido' },
]

function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtBs(usd: number, rate: number): string {
  return 'Bs. ' + (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Formatea un monto en la moneda activa. Bs sólo si hay tasa (>0); si no, cae a USD.
function money(usd: number, currency: Currency, rate: number): string {
  return currency === 'bs' && rate > 0 ? fmtBs(usd, rate) : fmtUsd(usd)
}

const MONTHLY_FULL = 19 // tarifa mensual sin descuento — base del tachado "sería"

export default function PricingSection({ bcvRate, showHeader = true, showMoreLink = true }: Props) {
  const [cycleIdx, setCycleIdx] = useState(0)
  const [currency, setCurrency] = useState<Currency>('usd')
  const cycle = CYCLE_ORDER[cycleIdx]
  const hasBs = bcvRate > 0

  return (
    <section className={styles.section} id="precios">
      <div className={styles.container}>
        {showHeader && (
          <div className={styles.head}>
            <h2 className={styles.title}>Un plan para cada etapa de tu negocio.</h2>
            <p className={styles.subtitle}>Sin contrato anual. Cambias de plan cuando quieras.</p>
          </div>
        )}

        <div className={styles.controls}>
          {hasBs && (
            <div className={styles.currencyToggle} role="group" aria-label="Moneda">
              <button
                type="button"
                aria-pressed={currency === 'usd'}
                className={`${styles.currencyBtn} ${currency === 'usd' ? styles.currencyBtnOn : ''}`}
                onClick={() => setCurrency('usd')}
              >
                USD
              </button>
              <button
                type="button"
                aria-pressed={currency === 'bs'}
                className={`${styles.currencyBtn} ${currency === 'bs' ? styles.currencyBtnOn : ''}`}
                onClick={() => setCurrency('bs')}
              >
                Bs
              </button>
            </div>
          )}

          <div className={styles.sliderWrap}>
            <input
              type="range"
              min={0}
              max={CYCLE_ORDER.length - 1}
              step={1}
              value={cycleIdx}
              onChange={e => setCycleIdx(Number(e.target.value))}
              className={styles.slider}
              aria-label="Ciclo de facturación"
              aria-valuetext={CYCLE_LABEL[cycle]}
              style={{ '--slider-pct': `${(cycleIdx / (CYCLE_ORDER.length - 1)) * 100}%` } as CSSProperties}
            />
            <div className={styles.ticks}>
              {CYCLE_ORDER.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.tick} ${i === cycleIdx ? styles.tickOn : ''}`}
                  onClick={() => setCycleIdx(i)}
                >
                  {CYCLE_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.grid}>
          {PLANS.map(({ tier, featured, badge }) => {
            const amounts   = tier === 'gratis' ? null : BILLING_CYCLES[tier][cycle]
            const waMsg     = encodeURIComponent(`Hola, me interesa el plan ${PLAN_DISPLAY[tier]} de ActivoPOS`)
            const feats     = featuresForTier(tier)
            // Moneda opuesta a la del hero — ambas siempre visibles (regla dual USD+Bs).
            const secondary = amounts
              ? (currency === 'usd'
                  ? (hasBs ? `${fmtBs(amounts.monthlyEquivalent, bcvRate)} /mes` : '')
                  : `${fmtUsd(amounts.monthlyEquivalent)} /mes`)
              : 'Para siempre, sin tarjeta'
            return (
              <div key={tier} className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
                {badge && <span className={styles.badge}>{badge}</span>}
                <h3 className={styles.planName}>{PLAN_DISPLAY[tier]}</h3>
                <div className={styles.priceRow}>
                  <span className={styles.priceUsd}>
                    {amounts ? money(amounts.monthlyEquivalent, currency, bcvRate) : 'Gratis'}
                  </span>
                  {amounts && <span className={styles.pricePeriod}>/mes</span>}
                </div>
                {amounts && amounts.savingsPct > 0 && (
                  <div className={styles.strikeRow}>
                    <span className={styles.strike}>{money(MONTHLY_FULL, currency, bcvRate)} /mes</span>
                    <span className={styles.savingsBadge}>Ahorra {amounts.savingsPct}%</span>
                  </div>
                )}
                <span className={styles.priceBs}>{secondary}</span>
                {amounts && cycle !== 'mensual' && (
                  <span className={styles.cycleNote}>
                    Total {money(amounts.totalAmount, currency, bcvRate)} facturado {CYCLE_LABEL[cycle].toLowerCase()}
                  </span>
                )}
                <ul className={styles.feats}>
                  {feats.map(f => (
                    <li key={f}>
                      <Check size={14} aria-hidden="true" />
                      <span className={styles.featLabel}>{f}</span>
                    </li>
                  ))}
                </ul>
                {tier === 'gratis' ? (
                  <Link href="/registro" className={styles.ctaBtn}>
                    <ArrowRight size={16} aria-hidden="true" />
                    Crear cuenta gratis
                  </Link>
                ) : (
                  <a
                    href={`${WA_BASE}?text=${waMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ctaBtnFeatured}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Empezar con {PLAN_DISPLAY[tier]}
                  </a>
                )}
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
