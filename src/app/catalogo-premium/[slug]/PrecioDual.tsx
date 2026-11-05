import Image from 'next/image'
import { fmtBs } from './catalogUtils'
import styles from './PrecioDual.module.css'

interface PrecioDualProps {
  /** Precio Cashea/Bs (el mayor, price_per_unit_usd). */
  priceUsd:           number
  priceBs:            number | null
  /** Precio Divisa ya validado por divisaPriceOf (0 < divisa < Cashea); null = un solo precio. */
  divisaUsd?:         number | null
  catalogVisibility?: 'visible' | 'on_request' | 'hidden'
  availability?:      'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  size?:              'card' | 'row' | 'modal'
  /** 'carta' = un precio grande en $ (Divisa si aplica) y el Bs de lista pequeño debajo; sin chips (los pagos van una vez en la Carta). */
  variant?:           'premium' | 'carta'
  /** Solo variante carta: antepone "Desde" (plato con tamaños). */
  desde?:             boolean
}

const fmtNum = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Bloque de precio único del catálogo premium.
 * Línea 1: Divisa en $ (o el precio Cashea en $ si no hay Divisa válida).
 * Línea 2: chip [Bs] + logo Cashea + ($ Cashea con Divisa | monto en Bs sin Divisa).
 */
export function PrecioDual({ priceUsd, priceBs, divisaUsd = null, catalogVisibility, availability, size = 'card', variant = 'premium', desde = false }: PrecioDualProps) {
  if (variant === 'carta') {
    if (!(priceUsd > 0)) return <div className={styles.carta}><span className={styles.cartaConsultar}>Consultar precio</span></div>
    const principal = divisaUsd ?? priceUsd
    return (
      <div className={`${styles.carta} ${styles['carta_' + size]}`}>
        {desde && <span className={styles.cartaDesde}>Desde</span>}
        <span className={styles.cartaUsd} data-testid="precio-principal"><span className={styles.cartaSimbolo}>$</span>{fmtNum(principal)}</span>
        {priceBs !== null && <span className={styles.cartaBs} data-testid="precio-bs">{fmtBs(priceBs)}</span>}
      </div>
    )
  }
  const cls = `${styles.block} ${styles[size]}`
  if (catalogVisibility === 'on_request') return <div className={cls}><span className={styles.consultar}>Consultar precio</span></div>
  if (availability === 'discontinued') return <div className={cls}><span className={styles.noDisponible}>No disponible</span></div>
  if (!(priceUsd > 0)) return <div className={cls}><span className={styles.consultar}>Consultar precio</span></div>
  const principal = divisaUsd ?? priceUsd
  const segunda   = divisaUsd !== null ? `$${fmtNum(priceUsd)}` : priceBs !== null ? fmtBs(priceBs) : null
  return (
    <div className={cls}>
      <span className={styles.usd} data-testid="precio-principal">
        <span className={styles.symbol}>$</span>{fmtNum(principal)}
      </span>
      {segunda !== null && (
        <span className={styles.line} data-testid="precio-cashea">
          <span className={styles.chipBs}>Bs</span>
          <Image src="/brand/cashea.png" alt="Cashea" width={49} height={14} className={styles.cashea} />
          {segunda}
        </span>
      )}
    </div>
  )
}
