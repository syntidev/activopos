'use client'

import { useState, useEffect } from 'react'
import { Crown, Calendar, ExternalLink, AlertCircle, Rocket, Check, X, MessageCircle } from 'lucide-react'
import styles from './TabPlan.module.css'

type PlanTier = 'trial' | 'inicio' | 'pro' | 'business'

interface PlanUsageData {
  plan:           PlanTier
  status:         'active' | 'trial' | 'expired' | 'suspended'
  expires_at:     string | null
  days_remaining: number | null
  usage: {
    products:        { used: number; limit: number }
    users:            { used: number; limit: number }
    catalog_enabled:  boolean
    ai_enabled:       boolean
  }
}

const PLAN_BADGE_CLASS: Record<PlanTier, string> = {
  trial:    styles.planBadgeTrial,
  inicio:   styles.planBadgeInicio,
  pro:      styles.planBadgePro,
  business: styles.planBadgeBusiness,
}

const PLAN_LABEL: Record<PlanTier, string> = {
  trial:    'TRIAL',
  inicio:   'INICIO',
  pro:      'PRO',
  business: 'BUSINESS',
}

function usageBarClass(used: number, limit: number): string {
  if (limit === -1) return styles.usageBarFillOk
  const pct = (used / limit) * 100
  if (pct > 90) return styles.usageBarFillDanger
  if (pct >= 70) return styles.usageBarFillWarning
  return styles.usageBarFillOk
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div className={styles.usageRow}>
        <span className={styles.usageLabel}>{label}</span>
        <span className={styles.usageValue}>{used} · ilimitado</span>
      </div>
    )
  }
  const pct = Math.min(100, (used / limit) * 100)
  return (
    <div className={styles.usageRow}>
      <div className={styles.usageHead}>
        <span className={styles.usageLabel}>{label}</span>
        <span className={styles.usageValue}>{used} / {limit}</span>
      </div>
      <div className={styles.usageBarTrack}>
        <div className={`${styles.usageBarFill} ${usageBarClass(used, limit)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FeatureRow({ label, enabled, requiredPlan }: { label: string; enabled: boolean; requiredPlan: string }) {
  return (
    <div className={styles.featureRow}>
      {enabled
        ? <Check size={15} className={styles.featureIconOn} aria-hidden="true" />
        : <X size={15} className={styles.featureIconOff} aria-hidden="true" />}
      <span className={enabled ? styles.featureLabelOn : styles.featureLabelOff}>{label}</span>
      {!enabled && <span className={styles.featureHint}>(en plan {requiredPlan})</span>}
    </div>
  )
}

function PlanUsageSection({ businessId }: { businessId: number }) {
  const [data,    setData]    = useState<PlanUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/plan')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: PlanUsageData & { ok: boolean }) => { if (j.ok) setData(j); else setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [businessId])

  if (loading) {
    return (
      <div className={styles.skeletonCard}>
        <div className={styles.skeletonLine} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineMd}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineSm}`} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.errorState}>
        <AlertCircle size={18} aria-hidden="true" />
        No se pudo cargar la información de uso del plan
      </div>
    )
  }

  const contactMsg = encodeURIComponent(
    `Hola ActivoPOS, quiero cambiar mi plan. Mi negocio ID es ${businessId}. Plan actual: ${data.plan}.`
  )
  const showExpiryAlert = data.days_remaining !== null && data.days_remaining >= 0 && data.days_remaining < 7

  return (
    <div className={styles.usageCard}>
      <div className={styles.usageCardHead}>
        <Rocket size={18} aria-hidden="true" />
        <h3 className={styles.usageCardTitle}>Tu Plan Actual</h3>
        <span className={`${styles.planBadge} ${PLAN_BADGE_CLASS[data.plan]}`}>{PLAN_LABEL[data.plan]}</span>
      </div>

      <p className={styles.usageExpiry}>
        {data.expires_at
          ? `Vence el ${new Date(data.expires_at.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}`
          : 'Sin vencimiento'}
      </p>

      <div className={styles.usageBox}>
        <p className={styles.usageBoxTitle}>Uso actual</p>
        <UsageRow label="Productos" used={data.usage.products.used} limit={data.usage.products.limit} />
        <UsageRow label="Usuarios"  used={data.usage.users.used}    limit={data.usage.users.limit} />
      </div>

      <div className={styles.featuresBox}>
        <FeatureRow label="Catálogo digital" enabled={data.usage.catalog_enabled} requiredPlan="Pro o superior" />
        <FeatureRow label="Asistente IA"     enabled={data.usage.ai_enabled}      requiredPlan="Business" />
      </div>

      {showExpiryAlert && (
        <div className={styles.expiryAlert}>
          <AlertCircle size={15} aria-hidden="true" />
          Quedan {data.days_remaining} {data.days_remaining === 1 ? 'día' : 'días'} para el vencimiento de tu plan.
        </div>
      )}

      <a
        href={`https://wa.me/584243244788?text=${contactMsg}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.contactBtn}
      >
        <MessageCircle size={15} aria-hidden="true" />
        Contactar para cambiar plan
      </a>
    </div>
  )
}

interface SubscriptionData {
  subscription_active:     boolean
  subscription_expires_at: string | null
  days_remaining:          number | null
}

type BadgeVariant = 'active' | 'soon' | 'expired' | 'no-date'

function getBadge(d: SubscriptionData): BadgeVariant {
  if (!d.subscription_active || (d.days_remaining !== null && d.days_remaining <= 0)) return 'expired'
  if (d.subscription_expires_at === null) return 'no-date'
  if (d.days_remaining !== null && d.days_remaining <= 5) return 'soon'
  return 'active'
}

function formatDate(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00')
    .toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function TabPlan({ businessId }: { businessId: number }) {
  const [data,    setData]    = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/config/subscription')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((j: { ok: boolean; plan: SubscriptionData }) => {
        if (j.ok) setData(j.plan)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [businessId])

  const waMsg = encodeURIComponent(
    `¡Hola! Quiero reportar un pago o renovar mi plan de ActivoPOS. Mi negocio ID es ${businessId}.`
  )

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.skeletonCard}>
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineMd}`} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineSm}`} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.wrap}>
        <div className={styles.errorState}>
          <AlertCircle size={18} aria-hidden="true" />
          No se pudo cargar la información del plan
        </div>
      </div>
    )
  }

  const badge    = getBadge(data)
  const expired  = badge === 'expired'
  const soon     = badge === 'soon'
  const planName = data.subscription_active ? 'Plan Activo' : 'Plan Vencido'
  const days     = data.days_remaining

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* Card head */}
        <div className={styles.cardHead}>
          <div className={`${styles.crownWrap} ${expired ? styles.crownExpired : soon ? styles.crownSoon : styles.crownActive}`}>
            <Crown size={22} aria-hidden="true" />
          </div>

          <div className={styles.planInfo}>
            <h2 className={styles.planName}>{planName}</h2>
            {data.subscription_expires_at && (
              <div className={styles.expiryRow}>
                <Calendar size={12} aria-hidden="true" />
                <span>Vence el {formatDate(data.subscription_expires_at)}</span>
              </div>
            )}
          </div>

          {badge === 'active' && (
            <span className={styles.badgeActive}>Activo</span>
          )}
          {badge === 'soon' && (
            <span className={styles.badgeSoon}>
              Vence pronto
            </span>
          )}
          {badge === 'expired' && (
            <span className={styles.badgeExpired}>Vencido</span>
          )}
          {badge === 'no-date' && (
            <span className={styles.badgeNoDate}>Sin fecha</span>
          )}
        </div>

        {/* Days progress bar */}
        {days !== null && !expired && (
          <div className={styles.daysSection}>
            <div className={styles.daysBar}>
              <div
                className={`${styles.daysBarFill} ${soon ? styles.daysBarFillSoon : styles.daysBarFillOk}`}
                style={{ width: `${Math.min(100, Math.max(2, (days / 365) * 100))}%` }}
              />
            </div>
            <span className={styles.daysLabel}>
              {days} {days === 1 ? 'día restante' : 'días restantes'}
            </span>
          </div>
        )}

        {expired && (
          <div className={styles.expiredNotice}>
            Tu plan ha vencido. Comunícate con soporte para reactivarlo.
          </div>
        )}

        {/* Renew CTA */}
        <a
          href={`https://wa.me/584243244788?text=${waMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.renewBtn}
        >
          <ExternalLink size={15} aria-hidden="true" />
          Reportar pago / Renovar
        </a>
      </div>

      <PlanUsageSection businessId={businessId} />
    </div>
  )
}
