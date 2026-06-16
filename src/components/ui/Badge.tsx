import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', size = 'md', children, className }: BadgeProps) {
  const cls = [
    styles.badge,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={cls}>{children}</span>
}
