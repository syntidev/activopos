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
import { KpiCard } from '@/components/ui/KpiCard'
import type { KpiIconVariant } from '@/components/ui/KpiCard'
import DashboardCharts    from './DashboardCharts'
import DashboardOperativo from './DashboardOperativo'
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
  iconVariant: KpiIconVariant
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
      key:         'ventas-hoy',
      label:       'Ventas hoy',
      valueUsd:    kpiData.ventas_hoy.value_usd,
      trendPct:    kpiData.ventas_hoy.trend_pct,
      icon:        ShoppingCart,
      iconVariant: 'brand',
    },
    {
      key:         'utilidad-hoy',
      label:       'Utilidad hoy',
      valueUsd:    kpiData.utilidad_hoy.value_usd,
      trendPct:    kpiData.utilidad_hoy.trend_pct,
      icon:        TrendingUp,
      iconVariant: 'success',
    },
    {
      key:         'ventas-mes',
      label:       'Ventas del mes',
      valueUsd:    kpiData.ventas_mes.value_usd,
      trendPct:    kpiData.ventas_mes.trend_pct,
      icon:        BarChart2,
      iconVariant: 'info',
    },
    {
      key:         'utilidad-mes',
      label:       'Utilidad del mes',
      valueUsd:    kpiData.utilidad_mes.value_usd,
      trendPct:    uMesTrend,
      icon:        DollarSign,
      iconVariant: uMesTrend >= 0 ? 'success' : 'warning',
    },
  ]

  return (
    <div className={styles.kpiGrid}>
      {kpis.map((kpi, index) => {
        const fmtValue = '$' + kpi.valueUsd.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const valueBs = kpiData.bcvRate > 0 ? fmtBs(kpi.valueUsd, kpiData.bcvRate) : undefined
        return (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={fmtValue}
            valueBs={valueBs}
            icon={kpi.icon}
            iconVariant={kpi.iconVariant}
            trendBadge={<TrendBadge pct={kpi.trendPct} />}
            hero={index === 0}
          />
        )
      })}
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
    <div className={`${styles.page} page-container`}>
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

      <DashboardCharts />
      <DashboardOperativo />
    </div>
  )
}

