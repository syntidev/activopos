'use client'

import { useState, useEffect } from 'react'
import { Crown, Calendar, ExternalLink, AlertCircle } from 'lucide-react'
import styles from './TabPlan.module.css'

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
          href={`https://wa.me/584143345985?text=${waMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.renewBtn}
        >
          <ExternalLink size={15} aria-hidden="true" />
          Reportar pago / Renovar
        </a>
      </div>
    </div>
  )
}
