'use client'

import { useState } from 'react'
import type { SalonSnapshot } from '@/types/restaurante'
import { ConfigRestaurante } from '../restaurante/ConfigRestaurante'
import { Modificadores } from '../restaurante/Modificadores'
import styles from './tabRestaurante.module.css'

interface TabRestauranteProps {
  initial: SalonSnapshot
  /** Clases de next/font del módulo: van en el mismo elemento que data-restaurante. */
  fontClass: string
}

/**
 * Configuración › Restaurante: Salón (áreas, mesas y plano) y Modificadores. Estaciones y ruteo llega con el KDS:
 * queda marcado como próxima sección, sin funcionalidad ni datos de mentira.
 */
export function TabRestaurante({ initial, fontClass }: TabRestauranteProps) {
  const [sub, setSub] = useState<'salon' | 'modificadores'>('salon')
  return (
    <div data-restaurante="" className={`${fontClass} ${styles.scope}`}>
      <nav className={styles.subnav} aria-label="Secciones de Restaurante">
        <button type="button" className={`${styles.sub} ${sub === 'salon' ? styles.subOn : ''}`} aria-current={sub === 'salon' ? 'page' : undefined} onClick={() => setSub('salon')}>Salón</button>
        <button type="button" className={`${styles.sub} ${sub === 'modificadores' ? styles.subOn : ''}`} aria-current={sub === 'modificadores' ? 'page' : undefined} onClick={() => setSub('modificadores')}>Modificadores</button>
        <button type="button" className={styles.sub} disabled aria-disabled="true">
          Estaciones y ruteo<span className={styles.soon}>Próximamente</span>
        </button>
      </nav>
      {sub === 'salon' ? <ConfigRestaurante initial={initial} /> : <Modificadores />}
    </div>
  )
}
