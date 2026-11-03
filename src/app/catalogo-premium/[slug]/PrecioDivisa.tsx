'use client'

import { useState } from 'react'
import Image from 'next/image'
import { fmtUsd, fmtBs } from './catalogUtils'
import styles from './precioDivisa.module.css'

export interface PayPill { id: number; name: string; type: string; is_financing: boolean }

interface PrecioDivisaProps {
  /** Precio Divisa efectivo (ya con el extra de la talla elegida). */
  divisaUsd: number
  /** Precio Full efectivo (el de siempre). */
  fullUsd: number
  rate: number
  /** Medios de cobro activos marcados como divisa en la configuración del negocio. */
  divisaMethods: PayPill[]
  /** Resto de medios de cobro activos (pago móvil, transferencia, Cashea…). */
  bsMethods: PayPill[]
}

type Mode = 'divisa' | 'bs'

/** Selector "$ Divisa | Bs Bolívares / Cashea": abre SIEMPRE en Divisa. Solo presentación: el carrito no cambia. */
export function PrecioDivisa({ divisaUsd, fullUsd, rate, divisaMethods, bsMethods }: PrecioDivisaProps) {
  const [mode, setMode] = useState<Mode>('divisa')
  const fullBs = fullUsd * rate

  return (
    <div className={styles.root} data-testid="precio-divisa">
      <div className={styles.switch} role="radiogroup" aria-label="Forma de pago para ver el precio">
        <button type="button" role="radio" aria-checked={mode === 'divisa'} className={`${styles.opt} ${mode === 'divisa' ? styles.optOn : ''}`} onClick={() => setMode('divisa')}>
          $ Divisa
        </button>
        <button type="button" role="radio" aria-checked={mode === 'bs'} className={`${styles.opt} ${mode === 'bs' ? styles.optOn : ''}`} onClick={() => setMode('bs')}>
          Bs Bolívares / Cashea
        </button>
      </div>

      {mode === 'divisa' ? (
        <>
          <span className={styles.price} data-testid="precio-principal">{fmtUsd(divisaUsd)}</span>
          <span className={styles.sub}>Pagando en Bs: {fmtBs(fullBs)}</span>
          <ul className={styles.pills} aria-label="Formas de pago en divisa">
            {divisaMethods.map(m => <li key={m.id} className={styles.pill}>{m.name}</li>)}
          </ul>
        </>
      ) : (
        <>
          <span className={styles.price} data-testid="precio-principal">{fmtBs(fullBs)}</span>
          <span className={styles.sub}>Equivale a {fmtUsd(fullUsd)}</span>
          <ul className={styles.pills} aria-label="Formas de pago en bolívares">
            {bsMethods.map(m => (
              <li key={m.id} className={styles.pill}>
                {m.is_financing && <Image src="/brand/cashea.png" alt="" width={48} height={16} className={styles.logo} />}
                {m.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
