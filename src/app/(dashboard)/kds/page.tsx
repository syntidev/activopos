'use client'

import { ChefHat } from 'lucide-react'
import styles from './kds.module.css'

export default function KDSPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.iconWrap} aria-hidden="true">
          <ChefHat size={40} strokeWidth={1.25} />
        </span>
        <h1 className={styles.title}>Pantalla de Cocina</h1>
        <p className={styles.desc}>
          El módulo KDS (Kitchen Display System) mostrará los pedidos en tiempo
          real para tu cocina — sin papel, sin demoras, sin errores de lectura.
        </p>
        <ul className={styles.featureList} aria-label="Funcionalidades previstas">
          <li>Órdenes entrantes en tiempo real con estado visual</li>
          <li>Prioridad por tiempo de espera</li>
          <li>Confirmación de preparación por ítem</li>
          <li>Alarma configurable por pedido demorado</li>
        </ul>
        <p className={styles.eta}>Disponible en Sprint 26</p>
      </div>
    </div>
  )
}
