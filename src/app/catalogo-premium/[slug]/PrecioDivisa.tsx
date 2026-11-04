'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
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

/** Color del ícono (inicial) por tipo de medio; lo que no tiene color propio queda en el verde de banco. */
const ICON_TONE: Record<string, string> = {
  binance: 'icoBinance', zelle: 'icoZelle', cash: 'icoCash', transfer: 'icoTransfer', card: 'icoBs',
}

function PayChip({ method }: { method: PayPill }) {
  if (method.is_financing) {
    return (
      <li className={styles.pay}>
        <Image src="/brand/cashea.png" alt={method.name} width={49} height={14} className={styles.logo} />
        en cuotas
      </li>
    )
  }
  return (
    <li className={styles.pay}>
      <i className={`${styles.ico} ${styles[ICON_TONE[method.type] ?? 'icoBank']}`} aria-hidden="true">{method.name.trim().charAt(0).toUpperCase()}</i>
      {method.name}
    </li>
  )
}

/**
 * Selector de moneda de la ficha (mockup v2): dos tarjetas-botón (radio) y caja de precio con "Paga con".
 * Abre SIEMPRE en Divisa (el default no se recuerda). Solo presentación: el carrito y el checkout no cambian.
 */
export function PrecioDivisa({ divisaUsd, fullUsd, rate, divisaMethods, bsMethods }: PrecioDivisaProps) {
  const [mode, setMode] = useState<Mode>('divisa')
  const divisaRef = useRef<HTMLButtonElement>(null)
  const bsRef = useRef<HTMLButtonElement>(null)
  const isDivisa = mode === 'divisa'
  const saving = fullUsd - divisaUsd
  const hasSaving = saving > 0.005

  function choose(next: Mode): void {
    setMode(next)
    ;(next === 'divisa' ? divisaRef : bsRef).current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose('bs') }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose('divisa') }
  }

  return (
    <div className={styles.root} data-testid="precio-divisa">
      <p className={styles.question} id="precio-divisa-q">¿Cómo vas a pagar?</p>
      <div className={styles.seg} role="radiogroup" aria-labelledby="precio-divisa-q" onKeyDown={onKeyDown}>
        <button ref={divisaRef} type="button" role="radio" aria-checked={isDivisa} tabIndex={isDivisa ? 0 : -1} className={styles.opt} onClick={() => setMode('divisa')}>
          <span className={styles.radio} aria-hidden="true" />
          {hasSaving && <span className={styles.badge}>MEJOR PRECIO</span>}
          <span className={styles.oname}>$ Divisa</span>
          <span className={styles.oprice}>{fmtUsd(divisaUsd)}</span>
        </button>
        <button ref={bsRef} type="button" role="radio" aria-checked={!isDivisa} tabIndex={isDivisa ? -1 : 0} className={styles.opt} onClick={() => setMode('bs')}>
          <span className={styles.radio} aria-hidden="true" />
          <span className={styles.oname}>
            <span className={styles.badgeBs}>Bs</span> Bolívares / <Image src="/brand/cashea.png" alt="Cashea" width={49} height={14} className={styles.logo} />
          </span>
          <span className={styles.oprice}>{fmtUsd(fullUsd)}</span>
        </button>
      </div>

      <div className={styles.pricebox}>
        {isDivisa ? (
          <>
            <span className={styles.price} data-testid="precio-principal">{fmtUsd(divisaUsd)}</span>
            {hasSaving && <span className={styles.sub}>Ahorras <b>{fmtUsd(saving)}</b> frente al pago en bolívares</span>}
          </>
        ) : (
          <>
            <span className={styles.price} data-testid="precio-principal">{fmtBs(fullUsd * rate)}</span>
            <span className={styles.sub}>Equivale a <b>{fmtUsd(fullUsd)}</b> · tasa BCV del día</span>
          </>
        )}
        <span className={styles.payt}>Paga con</span>
        <ul className={styles.pays} aria-label={isDivisa ? 'Formas de pago en divisa' : 'Formas de pago en bolívares'}>
          {(isDivisa ? divisaMethods : bsMethods).map(m => <PayChip key={m.id} method={m} />)}
        </ul>
      </div>
    </div>
  )
}
