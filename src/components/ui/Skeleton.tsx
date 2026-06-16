import styles from './Skeleton.module.css'

export type SkeletonVariant = 'text' | 'card' | 'circle' | 'rect'

export interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({ variant = 'rect', width, height, className }: SkeletonProps) {
  const cls = [styles.skeleton, styles[`variant-${variant}`], className ?? '']
    .filter(Boolean)
    .join(' ')

  const style: React.CSSProperties = {}
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  return <span className={cls} style={style} aria-hidden="true" />
}
