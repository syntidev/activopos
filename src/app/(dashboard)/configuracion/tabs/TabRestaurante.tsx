'use client'

import { useState } from 'react'
import type { SalonSnapshot } from '@/types/restaurante'
import { ConfigRestaurante } from '../restaurante/ConfigRestaurante'
import { EstacionesRuteo } from '../restaurante/EstacionesRuteo'
import { Modificadores } from '../restaurante/Modificadores'
import styles from './tabRestaurante.module.css'

interface TabRestauranteProps {
  initial: SalonSnapshot
  /** Clases de next/font del módulo: van en el mismo elemento que data-restaurante. */
  fontClass: string
}

/**
 * Configuración › Restaurante: Salón (áreas, mesas y plano), Modificadores y Estaciones y ruteo (KDS).
 */
export function TabRestaurante({ initial, fontClass }: TabRestauranteProps) {
  const [sub, setSub] = useState<'salon' | 'modificadores' | 'estaciones'>('salon')
  return (
    <div data-restaurante="" className={`${fontClass} ${styles.scope}`}>
      <nav className={styles.subnav} aria-label="Secciones de Restaurante">
        <button type="button" className={`${styles.sub} ${sub === 'salon' ? styles.subOn : ''}`} aria-current={sub === 'salon' ? 'page' : undefined} onClick={() => setSub('salon')}>Salón</button>
        <button type="button" className={`${styles.sub} ${sub === 'modificadores' ? styles.subOn : ''}`} aria-current={sub === 'modificadores' ? 'page' : undefined} onClick={() => setSub('modificadores')}>Modificadores</button>
        <button type="button" className={`${styles.sub} ${sub === 'estaciones' ? styles.subOn : ''}`} aria-current={sub === 'estaciones' ? 'page' : undefined} onClick={() => setSub('estaciones')}>Estaciones y ruteo</button>
      </nav>
      {sub === 'salon' ? <ConfigRestaurante initial={initial} /> : sub === 'modificadores' ? <Modificadores /> : <EstacionesRuteo />}
    </div>
  )
}
