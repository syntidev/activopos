import type { Metadata } from 'next'
import Link from 'next/link'
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
      <img
        src="/activopos-logo-flat-negative.svg"
        alt="ActivoPOS"
        className={styles.logo}
      />

      <span className={styles.iconWrap} aria-hidden="true">
        <ShoppingBag size={48} strokeWidth={1.5} />
      </span>

      <h1 className={styles.title}>Este catálogo no está disponible</h1>
      <p className={styles.subtitle}>
        El negocio que buscas no tiene su catálogo activo en este momento.
      </p>

      <div className={styles.separator} aria-hidden="true" />

      <p className={styles.ctaQuestion}>¿Tienes un negocio en Venezuela?</p>
      <Link href="/registro" className={styles.ctaButton}>
        Crea tu catálogo gratis →
      </Link>

      <p className={styles.legal}>
        ActivoPOS — El POS para negocios que andan activos.
      </p>
    </main>
  )
}
