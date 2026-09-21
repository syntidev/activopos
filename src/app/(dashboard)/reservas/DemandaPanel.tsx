'use client'

import { Factory } from 'lucide-react'
import type { DemandaResponse } from '@/types/reservas'
import styles from './reservas.module.css'

/**
 * Contador de demanda: unidades por kit + talla. Es el número real que se usa
 * para la orden de fabricación (no cuenta reservas, cuenta unidades).
 */
export function DemandaPanel({ demanda }: { demanda: DemandaResponse | null }) {
  if (!demanda) return null

  return (
    <section className={styles.demanda} aria-label="Demanda para fabricación">
      <div className={styles.demandaHeader}>
        <h2 className={styles.demandaTitle}>
          <Factory size={16} aria-hidden="true" />
          Demanda para fabricación
        </h2>
        <span className={styles.demandaTotal}>
          Total: <strong>{demanda.total_unidades}</strong> unidades
        </span>
      </div>

      {demanda.items.length === 0 ? (
        <p className={styles.modalText}>Aún no hay reservas para dimensionar el pedido.</p>
      ) : (
        <div className={styles.demandaGroup}>
          <p className={styles.demandaGroupLabel}>Kits por talla</p>
          <div className={styles.chips}>
            {demanda.items.map(i => (
              <span key={`${i.kit_id}-${i.componente ?? ''}-${i.talla ?? 'sin'}`} className={styles.chip}>
                {i.kit_nombre}{i.componente ? ` · ${i.componente}` : ''}{i.talla ? ` · ${i.talla}` : ' · sin talla'}
                <span className={styles.chipQty}>{i.unidades}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {demanda.extras.length > 0 ? (
        <div className={styles.demandaGroup}>
          <p className={styles.demandaGroupLabel}>Ítems extra</p>
          <div className={styles.chips}>
            {demanda.extras.map(e => (
              <span key={`${e.nombre}-${e.talla ?? 'sin'}`} className={styles.chip}>
                {e.nombre}{e.talla ? ` · ${e.talla}` : ''}
                <span className={styles.chipQty}>{e.unidades}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
