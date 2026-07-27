import type { Metadata } from 'next'
import styles from './not-found.module.css'

// Next usa nuestro componente en vez del not-found interno (que sí traía
// noindex solo) -> hay que declararlo explícito o esta página queda indexable
// por defecto (root layout.tsx pone robots index:true, follow:true global).
export const metadata: Metadata = {
  title:  'Página no encontrada',
  robots: 'noindex, follow',
}

const GHOST_KPIS = [
  { label: 'Cobrado',  value: '$0.00' },
  { label: 'Tickets',  value: '0' },
  { label: 'Crédito',  value: '$0.00' },
  { label: 'Utilidad', value: '$0.00' },
]

export default function NotFound() {
  return (
    <main className={styles.root}>
      <span className={styles.brand} aria-label="ActivoPOS">
        <img src="/activopos-logo-icon.svg" alt="" aria-hidden="true" className={styles.logoMark} />
        <span className={styles.logoWord} aria-hidden="true">
          <span className={styles.logoA}>Activo</span>
          <span className={styles.logoB}>POS</span>
        </span>
      </span>

      <p className={styles.code}>404</p>
      <h1 className={styles.title}>Esta página cerró su caja y se fue.</h1>
      <p className={styles.subtitle}>Como el inventario a fin de mes — ya no está.</p>

      <div className={styles.kpiGrid} aria-hidden="true">
        {GHOST_KPIS.map(kpi => (
          <div key={kpi.label} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue}>{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <a href="/" className={styles.ctaPrimary}>Volver al inicio</a>
        <a href="/planes" className={styles.ctaSecondary}>Ver planes</a>
      </div>

      <p className={styles.footer}>Error 404 · activopos.com</p>
    </main>
  )
}
