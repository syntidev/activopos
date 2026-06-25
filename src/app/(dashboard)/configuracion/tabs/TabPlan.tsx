'use client'

import { useState, useEffect } from 'react'
import { Crown, Calendar, ExternalLink } from 'lucide-react'
import styles from './TabPlan.module.css'

interface PlanData {
  subscription_active:     boolean
  subscription_expires_at: string | null
  plan_name:               string | null
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr)
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function TabPlan({ businessId }: { businessId: number }) {
  const [data,    setData]    = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.ok ? r.json() : null)
      .then((j: Record<string, unknown> | null) => {
        if (j) {
          setData({
            subscription_active:     Boolean(j.subscription_active ?? true),
            subscription_expires_at: typeof j.subscription_expires_at === 'string'
              ? j.subscription_expires_at
              : null,
            plan_name: typeof j.plan_name === 'string' ? j.plan_name : null,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])

  if (loading) return <div className={styles.loading}>Cargando plan…</div>

  const days    = daysUntil(data?.subscription_expires_at ?? null)
  const expired = data?.subscription_active === false || (days !== null && days < 0)
  const soon    = !expired && days !== null && days < 30
  const planName = data?.plan_name ?? 'Plan ActivoPOS'

  const waMsg = encodeURIComponent(
    `¡Hola! Quiero reportar un pago o renovar mi plan de ActivoPOS. Mi negocio ID es ${businessId}.`
  )

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
            {data?.subscription_expires_at && (
              <div className={styles.expiryRow}>
                <Calendar size={12} aria-hidden="true" />
                <span>
                  Vence el{' '}
                  {new Date(data.subscription_expires_at).toLocaleDateString('es-VE', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {expired ? (
            <span className={styles.badgeExpired}>Plan vencido</span>
          ) : soon ? (
            <span className={styles.badgeSoon}>
              Vence en {days} {days === 1 ? 'día' : 'días'}
            </span>
          ) : (
            <span className={styles.badgeActive}>Activo</span>
          )}
        </div>

        {/* Days bar */}
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
