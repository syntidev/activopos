'use client'

import type { PriceMode } from '@/lib/pos'
import styles from './PriceModeSwitch.module.css'

export const PRICE_MODE_LABEL: Record<PriceMode, string> = {
  bcv:    'BCV (Bs)',
  divisa: 'Divisa ($)',
}

const MODES: ReadonlyArray<PriceMode> = ['bcv', 'divisa']

interface PriceModeSwitchProps {
  mode: PriceMode
  /** Sin onChange o con readOnly (ticket cobrado) solo se muestra el modo, sin controles. */
  onChange?: (mode: PriceMode) => void
  readOnly?: boolean
  busy?: boolean
  /** Mensaje del servidor (p. ej. 409 "ya fue cobrada"), tal cual. */
  error?: string
  /** Líneas pedidas en Divisa que no tienen precio Divisa y se cobran a BCV. */
  fallbackLines?: number
}

/**
 * Semáforo de precio del ticket: "BCV (Bs)" por defecto o "Divisa ($)". Va siempre junto al total del
 * carrito/pedido. Contrato: .doc/CONTRATO_PRECIO_DIVISA.md.
 */
export function PriceModeSwitch({ mode, onChange, readOnly = false, busy = false, error, fallbackLines = 0 }: PriceModeSwitchProps) {
  const interactive = !readOnly && onChange !== undefined

  return (
    <div className={styles.wrap}>
      {interactive ? (
        <div className={styles.group} role="radiogroup" aria-label="Modo de precio del ticket">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`${styles.option} ${mode === m ? styles.optionActive : ''}`}
              onClick={() => onChange(m)}
              disabled={busy}
            >
              {PRICE_MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.readOnly}>
          Modo de precio: <strong>{PRICE_MODE_LABEL[mode]}</strong>
        </p>
      )}
      {fallbackLines > 0 && (
        <p className={styles.note} role="status">
          {fallbackLines === 1 ? '1 línea sin precio Divisa usa el BCV' : `${fallbackLines} líneas sin precio Divisa usan el BCV`}
        </p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  )
}
