import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { fmtBs, fmtUsd } from '@/app/catalogo-premium/[slug]/catalogUtils'
import styles from './pulso.module.css'

/** Ancho dinámico de barra: única excepción tolerada de `style` (un valor por barra, no se puede
 *  expresar en CSS Modules estático). Solo define la custom property --w; el resto vive en el .css. */
type BarStyle = CSSProperties & { '--w': string }
const barStyle = (pct: number): BarStyle => ({ '--w': `${Math.max(0, Math.min(100, pct))}%` })

export const EMPTY_TEXT = 'Aún no hay visitas en este rango'

export function Card({ title, icon: Icon, children, wide = false, accent = false }: {
  title: string
  icon: LucideIcon
  children: ReactNode
  wide?: boolean
  accent?: boolean
}) {
  const cls = [styles.card, wide ? styles.wide : '', accent ? styles.cardAccent : ''].join(' ').trim()
  return (
    <section className={cls}>
      <h2 className={styles.cardTitle}>
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Empty({ text = EMPTY_TEXT }: { text?: string }) {
  return <p className={styles.empty}>{text}</p>
}

export function Money({ usd, bs }: { usd: number; bs: number }) {
  return (
    <span className={styles.money}>
      <span className={styles.moneyUsd}>{fmtUsd(usd)}</span>
      <span className={styles.moneyBs}>{fmtBs(bs)}</span>
    </span>
  )
}

export interface BarItem {
  label: string
  value: number
  /** Texto a la derecha en lugar del número (p. ej. "42 · 18%") */
  display?: string
}

export function Bars({ items, empty, tone = 'brand' }: {
  items: BarItem[]
  empty?: string
  tone?: 'brand' | 'warning'
}) {
  if (items.length === 0) return <Empty text={empty} />
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <ul className={styles.bars}>
      {items.map(i => (
        <li key={i.label} className={styles.barRow}>
          <div className={styles.barHead}>
            <span className={styles.barLabel}>{i.label}</span>
            <span className={styles.barValue}>{i.display ?? i.value}</span>
          </div>
          <div className={styles.barTrack}>
            <div
              className={tone === 'warning' ? `${styles.barFill} ${styles.barFillWarning}` : styles.barFill}
              style={barStyle((i.value / max) * 100)}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Barras verticales de visitantes por día (mini-gráfica). */
export function DailyChart({ days, label = 'Visitantes por día', empty }: {
  days: { fecha: string; visitantes: number }[]
  label?: string
  empty?: string
}) {
  const max = Math.max(...days.map(d => d.visitantes), 1)
  const total = days.reduce((a, d) => a + d.visitantes, 0)
  if (total === 0) return <Empty text={empty} />
  return (
    <ol className={styles.daily} aria-label={label}>
      {days.map(d => (
        <li key={d.fecha} className={styles.dailyCol} title={`${d.fecha}: ${d.visitantes}`}>
          <div className={styles.dailyBarWrap}>
            <div className={styles.dailyBar} style={barStyle((d.visitantes / max) * 100)} />
          </div>
          <span className={styles.dailyLabel}>{d.fecha.slice(8)}</span>
          <span className="sr-only">{`${d.fecha}: ${d.visitantes}`}</span>
        </li>
      ))}
    </ol>
  )
}

export function Kpi({ icon: Icon, label, children, tone, hero = false }: {
  icon: LucideIcon
  label: string
  children: ReactNode
  tone: 'green' | 'amber' | 'blue' | 'purple'
  hero?: boolean
}) {
  const toneCls = { green: styles.toneGreen, amber: styles.toneAmber, blue: styles.toneBlue, purple: styles.tonePurple }[tone]
  return (
    <div className={hero ? `${styles.kpi} ${styles.kpiHero}` : styles.kpi}>
      <span className={`${styles.kpiIcon} ${toneCls}`} aria-hidden="true">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <div className={styles.kpiBody}>
        <span className={styles.kpiLabel}>{label}</span>
        <div className={styles.kpiValue}>{children}</div>
      </div>
    </div>
  )
}
