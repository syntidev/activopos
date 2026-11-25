'use client'

import type { SalonSnapshot } from '@/types/restaurante'
import { ConfigRestaurante } from '../restaurante/ConfigRestaurante'
import styles from './tabRestaurante.module.css'

interface TabRestauranteProps {
  initial: SalonSnapshot
  /** Clases de next/font del módulo: van en el mismo elemento que data-restaurante. */
  fontClass: string
}

/**
 * Configuración › Restaurante. Hoy solo "Salón" (áreas, mesas y plano). Modificadores y Estaciones/ruteo
 * quedan marcados como próximas secciones: sin funcionalidad ni datos de mentira.
 */
export function TabRestaurante({ initial, fontClass }: TabRestauranteProps) {
  return (
    <div data-restaurante="" className={`${fontClass} ${styles.scope}`}>
      <nav className={styles.subnav} aria-label="Secciones de Restaurante">
        <button type="button" className={`${styles.sub} ${styles.subOn}`} aria-current="page">Salón</button>
        <button type="button" className={styles.sub} disabled aria-disabled="true">
          Modificadores<span className={styles.soon}>Próximamente</span>
        </button>
        <button type="button" className={styles.sub} disabled aria-disabled="true">
          Estaciones y ruteo<span className={styles.soon}>Próximamente</span>
        </button>
      </nav>
      <ConfigRestaurante initial={initial} />
    </div>
  )
}
