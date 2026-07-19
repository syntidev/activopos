import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import RevealSection from './shared/RevealSection'
import styles from './MarketingHero.module.css'

const MAX_WIDTH_CLASS: Record<760 | 960 | 1100, string> = {
  760: styles.mw760,
  960: styles.mw960,
  1100: styles.mw1100,
}

const ICON_SIZE_CLASS = {
  sm: styles.iconSizeSm,
  lg: styles.iconSizeLg,
}

interface MarketingHeroProps {
  icon: LucideIcon
  maxWidth: 760 | 960 | 1100
  /** 'sm' (default) para heroes con poco espacio vertical antes del título
   *  (badge+título+subtítulo apretados); 'lg' cuando hay más presupuesto
   *  vertical libre y el ícono default se ve demasiado chico para leerse. */
  iconSize?: 'sm' | 'lg'
  className?: string
  children: ReactNode
}

export default function MarketingHero({ icon: Icon, maxWidth, iconSize = 'sm', className, children }: MarketingHeroProps) {
  return (
    <header className={className ? `${styles.hero} ${className}` : styles.hero}>
      <Icon className={`${styles.heroIcon} ${ICON_SIZE_CLASS[iconSize]}`} strokeWidth={1} aria-hidden="true" />
      <RevealSection>
        <div className={`${styles.heroInner} ${MAX_WIDTH_CLASS[maxWidth]}`}>
          {children}
        </div>
      </RevealSection>
    </header>
  )
}
