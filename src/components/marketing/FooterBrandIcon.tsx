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
        src="/brand/activopos/activopos-logo-icon.svg"
        alt=""
        aria-hidden="true"
        className={styles.brandIconImg}
      />
    </button>
  )
}
