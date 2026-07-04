'use client'

import { useState, useEffect } from 'react'
import adminStyles from '../admin.module.css'
import styles from './settings.module.css'

type LoadState = 'loading' | 'error' | 'ready'

export function BcvRateSection() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [rate, setRate]           = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/rates/bcv')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((body: { ok: boolean; bcv: number }) => {
        setRate(body.bcv)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tasa BCV</h2>
      <p className={styles.sectionSubtitle}>Última tasa activa en la base de datos</p>

      {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
      {loadState === 'error' && <div className={adminStyles.emptyState}>No se pudo obtener la tasa BCV.</div>}
      {loadState === 'ready' && rate !== null && (
        <div className={styles.rateCard}>
          <span className={styles.rateValue}>{rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
          <span className={styles.rateUnit}>Bs/USD</span>
        </div>
      )}
      <p className={styles.rateNote}>
        Fecha de última actualización y refresco manual pendientes — GET /api/rates/bcv no expone fetched_at
        y no existe un endpoint POST para forzar el refresco (backend, fuera de este scope).
      </p>
    </div>
  )
}
