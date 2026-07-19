import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import RevealSection from './shared/RevealSection'
import styles from './MarketingHero.module.css'

const MAX_WIDTH_CLASS: Record<760 | 960 | 1100, string> = {
  760: styles.mw760,
  960: styles.mw960,
  1100: styles.mw1100,
}

interface MarketingHeroProps {
  icon: LucideIcon
  maxWidth: 760 | 960 | 1100
  className?: string
  children: ReactNode
}

export default function MarketingHero({ icon: Icon, maxWidth, className, children }: MarketingHeroProps) {
  return (
    <header className={className ? `${styles.hero} ${className}` : styles.hero}>
      <Icon className={styles.heroIcon} strokeWidth={1} aria-hidden="true" />
      <RevealSection>
        <div className={`${styles.heroInner} ${MAX_WIDTH_CLASS[maxWidth]}`}>
          {children}
        </div>
      </RevealSection>
    </header>
  )
}
