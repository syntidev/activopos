import type { Metadata } from 'next'
import { ShoppingBag } from 'lucide-react'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Catálogo no disponible — ActivoPOS',
  description: 'El negocio que buscas no tiene su catálogo activo. Crea el tuyo gratis con ActivoPOS.',
  robots: 'noindex, follow',
}

export default function CatalogoNoDisponiblePage() {
  return (
    <main className={styles.root}>
      <span className={styles.brand} aria-label="ActivoPOS">
        <img
          src="/activopos-logo-negative.svg"
          alt=""
          aria-hidden="true"
          className={styles.logoMark}
        />
        <span className={styles.logoWord} aria-hidden="true">
          <span className={styles.logoA}>Activo</span>
          <span className={styles.logoB}>POS</span>
        </span>
      </span>

      <span className={styles.iconWrap} aria-hidden="true">
        <ShoppingBag size={48} strokeWidth={1.5} />
      </span>

      <h1 className={styles.title}>Este catálogo no está disponible</h1>
      <p className={styles.subtitle}>
        El negocio que buscas no tiene su catálogo activo en este momento.
      </p>

      <div className={styles.separator} aria-hidden="true" />

      <p className={styles.ctaQuestion}>¿Tienes un negocio en Venezuela?</p>
      <a href="https://activopos.com" className={styles.ctaButton}>
        Crea tu catálogo gratis →
      </a>

      <p className={styles.legal}>
        ActivoPOS — El POS para negocios que andan activos.
      </p>
    </main>
  )
}
