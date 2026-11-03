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
  /** Medios de Bs (pago móvil, transferencia, Cashea). */
  bsMethods: PayPill[]
}

type Mode = 'divisa' | 'bs'

/** Color de la pastilla de divisa por tipo de medio (binance ámbar, zelle violeta, efectivo verde, el resto celeste). */
const DIVISA_TONE: Record<string, string> = { binance: 'toneAmber', zelle: 'toneViolet', cash: 'toneGreen' }

/**
 * Selector de moneda de la ficha: pastilla compacta "$ Divisa | [Bs] Bolívares / [cashea]". Abre SIEMPRE en Divisa
 * (el default no se recuerda). Solo presentación: el carrito y el checkout no cambian.
 */
export function PrecioDivisa({ divisaUsd, fullUsd, rate, divisaMethods, bsMethods }: PrecioDivisaProps) {
  const [mode, setMode] = useState<Mode>('divisa')
  const isDivisa = mode === 'divisa'

  return (
    <div className={styles.root} data-testid="precio-divisa">
      <div className={styles.toggle} role="group" aria-label="Moneda de pago">
        <button type="button" className={styles.opt} aria-pressed={isDivisa} onClick={() => setMode('divisa')}>
          $ Divisa
        </button>
        <button type="button" className={styles.opt} aria-pressed={!isDivisa} onClick={() => setMode('bs')}>
          <span className={styles.badgeBs}>Bs</span> Bolívares / <Image src="/brand/cashea.png" alt="Cashea" width={49} height={14} className={styles.logo} />
        </button>
      </div>

      {isDivisa ? (
        <>
          <span className={styles.price} data-testid="precio-principal">{fmtUsd(divisaUsd)}</span>
          <ul className={styles.pills} aria-label="Formas de pago en divisa">
            {divisaMethods.map(m => (
              <li key={m.id} className={`${styles.pill} ${styles[DIVISA_TONE[m.type] ?? 'toneSky']}`}>{m.name}</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <span className={styles.price} data-testid="precio-principal">{fmtBs(fullUsd * rate)}</span>
          <span className={styles.sub}>Equivale a <b>{fmtUsd(fullUsd)}</b></span>
          <ul className={styles.pills} aria-label="Formas de pago en bolívares">
            {bsMethods.map(m => (
              <li key={m.id} className={`${styles.pill} ${styles.toneNeutral}`}>
                {m.is_financing && <Image src="/brand/cashea.png" alt="" width={49} height={14} className={styles.logo} />}
                {m.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
