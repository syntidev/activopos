'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, Loader2, CheckCircle2, Download, X } from 'lucide-react'
import styles from './MonthlyReportBanner.module.css'

type ReportStatus = 'pending' | 'generating' | 'ready'

interface MonthlyReport {
  status:      ReportStatus
  period:      string
  summary?: {
    salesCount: number
    totalUsd:   number
    activeDays: number
  }
  download_url?: string
}

interface Props {
  period:      string  // "2026-05"
  periodLabel: string  // "mayo 2026"
}

export function MonthlyReportBanner({ period, periodLabel }: Props) {
  const [report,    setReport]    = useState<MonthlyReport | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/monthly?period=${period}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.ok && data.report) setReport(data.report)
    } catch {
      // endpoint not yet available → don't show banner
    }
  }, [period])

  useEffect(() => {
    fetchStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const handleGenerate = async () => {
    setReport(r => r ? { ...r, status: 'generating' } : null)
    try {
      const res = await fetch('/api/reports/monthly/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ period }),
      })
      if (!res.ok) { setReport(r => r ? { ...r, status: 'pending' } : null); return }

      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/reports/monthly?period=${period}`)
          if (sr.ok) {
            const data = await sr.json()
            if (data.report?.status === 'ready') {
              setReport(data.report)
              stopPoll()
            }
          }
        } catch { stopPoll() }
      }, 2000)

      setTimeout(stopPoll, 30_000)
    } catch {
      setReport(r => r ? { ...r, status: 'pending' } : null)
    }
  }

  if (!report || dismissed) return null

  const fmtUsd = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      className={`${styles.banner} ${styles[`banner_${report.status}`]}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.bannerInner}>
        <div className={styles.bannerIcon} aria-hidden="true">
          {report.status === 'generating' ? (
            <Loader2 size={18} className={styles.spinIcon} />
          ) : report.status === 'ready' ? (
            <CheckCircle2 size={18} />
          ) : (
            <TrendingUp size={18} />
          )}
        </div>

        <div className={styles.bannerBody}>
          {report.status === 'pending' && (
            <>
              <p className={styles.bannerTitle}>
                Tu reporte de {periodLabel} está listo para generar
              </p>
              <p className={styles.bannerSub}>
                Consolida todas tus ventas del mes en un PDF profesional
              </p>
            </>
          )}
          {report.status === 'generating' && (
            <>
              <p className={styles.bannerTitle}>Generando tu reporte de {periodLabel}…</p>
              <p className={styles.bannerSub}>Esto toma unos segundos</p>
            </>
          )}
          {report.status === 'ready' && report.summary && (
            <>
              <p className={styles.bannerTitle}>
                Tu reporte de {periodLabel} está listo
              </p>
              <p className={styles.bannerSub}>
                {report.summary.salesCount} ventas ·{' '}
                {fmtUsd(report.summary.totalUsd)} ·{' '}
                {report.summary.activeDays} días activos
              </p>
            </>
          )}
        </div>

        <div className={styles.bannerActions}>
          {report.status === 'pending' && (
            <button
              type="button"
              className={styles.bannerBtn}
              onClick={handleGenerate}
            >
              Generar ahora →
            </button>
          )}
          {report.status === 'ready' && report.download_url && (
            <a
              href={report.download_url}
              download
              className={styles.bannerBtn}
            >
              <Download size={14} aria-hidden="true" />
              Descargar PDF
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.bannerClose}
        onClick={() => setDismissed(true)}
        aria-label="Cerrar banner"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
