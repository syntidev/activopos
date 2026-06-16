import { Suspense } from 'react'
import { getSession } from '@/lib/auth'
import { getKpiData, getGreeting, fmtBs } from '@/lib/dashboard'
import {
  ShoppingCart,
  TrendingUp,
  BarChart2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './escritorio.module.css'

export const metadata = {
  title: 'Escritorio — ActivoPOS',
}

interface KpiItem {
  key: string
  label: string
  valueUsd: number
  trendPct: number
  icon: LucideIcon
  iconClass: string
}

function KpiSkeleton() {
  return (
    <div className={styles.kpiGrid}>
      {['vhoy', 'uhoy', 'vmes', 'umes'].map((k) => (
        <div key={k} className={styles.kpiCard} aria-busy="true" aria-label="Cargando">
          <div className={styles.kpiCardTop}>
            <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
            <div className={`${styles.skeleton} ${styles.skeletonTrend}`} />
          </div>
          <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
          <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSub}`} />
        </div>
      ))}
    </div>
  )
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 0) {
    return (
      <span className={`${styles.trendBadge} ${styles.trendUp}`}>
        <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />
        {pct.toFixed(1)}%
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span className={`${styles.trendBadge} ${styles.trendDown}`}>
        <ArrowDownRight size={11} strokeWidth={2.5} aria-hidden="true" />
        {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className={`${styles.trendBadge} ${styles.trendNeutral}`}>
      <Minus size={11} strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}

async function KpiCards({ businessId }: { businessId: number }) {
  const kpiData = await getKpiData(businessId)

  const uMesTrend = kpiData.utilidad_mes.trend_pct

  const kpis: KpiItem[] = [
    {
      key:       'ventas-hoy',
      label:     'Ventas hoy',
      valueUsd:  kpiData.ventas_hoy.value_usd,
      trendPct:  kpiData.ventas_hoy.trend_pct,
      icon:      ShoppingCart,
      iconClass: styles.iconBrand,
    },
    {
      key:       'utilidad-hoy',
      label:     'Utilidad hoy',
      valueUsd:  kpiData.utilidad_hoy.value_usd,
      trendPct:  kpiData.utilidad_hoy.trend_pct,
      icon:      TrendingUp,
      iconClass: styles.iconSuccess,
    },
    {
      key:       'ventas-mes',
      label:     'Ventas del mes',
      valueUsd:  kpiData.ventas_mes.value_usd,
      trendPct:  kpiData.ventas_mes.trend_pct,
      icon:      BarChart2,
      iconClass: styles.iconInfo,
    },
    {
      key:       'utilidad-mes',
      label:     'Utilidad del mes',
      valueUsd:  kpiData.utilidad_mes.value_usd,
      trendPct:  uMesTrend,
      icon:      DollarSign,
      iconClass: uMesTrend >= 0 ? styles.iconSuccess : styles.iconWarning,
    },
  ]

  return (
    <div className={styles.kpiGrid}>
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div key={kpi.key} className={styles.kpiCard}>
            <div className={styles.kpiCardTop}>
              <div className={`${styles.iconCircle} ${kpi.iconClass}`}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </div>
              <TrendBadge pct={kpi.trendPct} />
            </div>
            <p className={styles.kpiLabel}>{kpi.label}</p>
            <p className={styles.kpiValue}>
              <span className={styles.kpiCurrency}>$</span>
              {kpi.valueUsd.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            {kpiData.bcvRate > 0 && (
              <p className={styles.kpiBs}>{fmtBs(kpi.valueUsd, kpiData.bcvRate)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SectionSkeletons() {
  return (
    <div className={styles.sectionsGrid}>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Ventas recientes</h3>
        </div>
        <div className={styles.sectionBody}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.rowSkeleton}>
              <div className={`${styles.skeleton} ${styles.skeletonRowLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonRowValue}`} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Stock bajo</h3>
        </div>
        <div className={styles.sectionBody}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.rowSkeleton}>
              <div className={`${styles.skeleton} ${styles.skeletonRowLabel}`} />
              <div className={`${styles.skeleton} ${styles.skeletonRowBadge}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function EscritorioPage() {
  const session  = await getSession()
  const now      = new Date()
  const greeting = getGreeting(now.getHours())
  const userName = session?.name ?? 'Usuario'

  const dateStr = now.toLocaleDateString('es-VE', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  })

  return (
    <div className={styles.page}>
      <div className={styles.welcomeRow}>
        <div>
          <h2 className={styles.welcomeTitle}>
            {greeting}, {userName}
          </h2>
          <p className={styles.welcomeSub}>{dateStr}</p>
        </div>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiCards businessId={session?.businessId ?? 0} />
      </Suspense>

      <SectionSkeletons />
    </div>
  )
}

