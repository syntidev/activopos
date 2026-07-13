'use client'

import styles from './MarketingFooter.module.css'

export function FooterBrandIcon() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <button
      type="button"
      className={styles.brandIconBtn}
      onClick={scrollToTop}
      aria-label="Volver arriba"
    >
      <img
        src="/brand/activopos/activopos-logo-flat-negative.svg"
        alt="ActivoPOS"
        width={40}
        height={40}
        className={styles.brandIconImg}
      />
    </button>
  )
}
