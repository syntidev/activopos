'use client'

import { useState, useEffect, useCallback } from 'react'
import { PartyPopper, MessageCircle, X } from 'lucide-react'
import styles from './DashboardReportAlert.module.css'

interface ReportNotification {
  id:             number
  period:         string
  download_token: string | null
  wa_url:         string | null
  notified_at:    string
}

interface MyNotificationResponse {
  ok:           boolean
  notification: ReportNotification | null
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
}

export function DashboardReportAlert() {
  const [notification, setNotification] = useState<ReportNotification | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/reports/monthly/my-notification')
      .then(res => res.ok ? res.json() as Promise<MyNotificationResponse> : null)
      .then(data => { if (!cancelled && data?.ok) setNotification(data.notification) })
      .catch(() => {
        // Endpoint no disponible o sin sesión → no mostrar el banner
      })
    return () => { cancelled = true }
  }, [])

  const markSeen = useCallback((id: number) => {
    void fetch(`/api/reports/monthly/${id}/mark-seen`, { method: 'PATCH' })
  }, [])

  if (!notification) return null

  const handleShare = () => {
    markSeen(notification.id)
    setNotification(null)
  }

  const handleClose = () => {
    markSeen(notification.id)
    setNotification(null)
  }

  return (
    <div className={styles.alert} role="status" aria-live="polite">
      <div className={styles.alertInner}>
        <div className={styles.alertIcon} aria-hidden="true">
          <PartyPopper size={18} />
        </div>

        <div className={styles.alertBody}>
          <p className={styles.alertTitle}>
            Tu reporte de {periodLabel(notification.period)} ya está listo
          </p>
          <p className={styles.alertSub}>Compártelo con un clic</p>
        </div>

        <div className={styles.alertActions}>
          {notification.wa_url && (
            <a
              href={notification.wa_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.alertBtn}
              onClick={handleShare}
            >
              <MessageCircle size={14} aria-hidden="true" />
              Compartir
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.alertClose}
        onClick={handleClose}
        aria-label="Cerrar aviso"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
