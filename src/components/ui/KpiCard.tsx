import type { LucideIcon } from 'lucide-react'
import styles from './KpiCard.module.css'

export type KpiIconVariant = 'brand' | 'success' | 'info' | 'warning'

const ICON_CLASS: Record<KpiIconVariant, string> = {
  brand:   styles.iconBrand,
  success: styles.iconSuccess,
  info:    styles.iconInfo,
  warning: styles.iconWarning,
}

export interface KpiCardProps {
  label: string
  value: string
  valueBs?: string
  icon: LucideIcon
  iconVariant?: KpiIconVariant
  trendBadge?: React.ReactNode
  hero?: boolean
}

export function KpiCard({
  label,
  value,
  valueBs,
  icon: Icon,
  iconVariant = 'brand',
  trendBadge,
  hero = false,
}: KpiCardProps) {
  const iconClass = hero ? styles.iconHero : ICON_CLASS[iconVariant]

  return (
    <div className={`${styles.card} ${hero ? styles.cardHero : styles.cardGlow}`}>
      <div className={styles.cardTop}>
        <div className={`${styles.iconWrap} ${iconClass}`}>
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </div>
        {trendBadge}
      </div>
      <p className={`${styles.cardLabel} ${hero ? styles.cardLabelHero : ''}`}>{label}</p>
      <p className={`${styles.cardValue} ${hero ? styles.cardValueHero : ''}`}>{value}</p>
      {valueBs && (
        <p className={`${styles.cardBs} ${hero ? styles.cardBsHero : ''}`}>{valueBs}</p>
      )}
    </div>
  )
}
