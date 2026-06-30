'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal, Button } from '@/components/ui'
import styles from './PinDescuentoModal.module.css'

interface PinDescuentoModalProps {
  open: boolean
  onClose: () => void
  currentPct: number
  totalUsd: number
  onApply: (discountPct: number, pin: string) => Promise<void>
}

export function PinDescuentoModal({
  open,
  onClose,
  currentPct,
  totalUsd,
  onApply,
}: PinDescuentoModalProps) {
  const [type, setType]           = useState<'pct' | 'fixed'>('pct')
  const [value, setValue]         = useState(currentPct > 0 ? String(currentPct) : '')
  const [pin, setPin]             = useState<string[]>(['', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [shaking, setShaking]     = useState(false)
  const [pinError, setPinError]   = useState(false)

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    if (open) {
      setType('pct')
      setValue(currentPct > 0 ? String(currentPct) : '')
      setPin(['', '', '', ''])
      setErrorMsg('')
      setRateLimited(false)
      setShaking(false)
      setPinError(false)
      setIsLoading(false)
    }
  }, [open, currentPct])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setPinError(true)
    setPin(['', '', '', ''])
    setTimeout(() => {
      setShaking(false)
      setPinError(false)
      pinRefs[0].current?.focus()
    }, 600)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next  = [...pin]
    next[idx]   = digit
    setPin(next)
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus()
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus()
    }
  }

  const num = parseFloat(value) || 0
  // ponytail: convert fixed USD → pct so onApply signature stays unchanged
  const pct        = type === 'pct' ? num : totalUsd > 0 ? (num / totalUsd) * 100 : 0
  const previewUsd = totalUsd * (pct / 100)
  const pinFull    = pin.every(d => d !== '')

  const handleSubmit = async () => {
    const pinStr = pin.join('')
    if (pinStr.length < 4) { setErrorMsg('Ingresa los 4 dígitos del PIN'); return }
    if (num <= 0)           { setErrorMsg('Ingresa un valor mayor a 0'); return }
    if (type === 'pct' && num > 99.99) { setErrorMsg('El porcentaje debe ser menor a 100%'); return }
    if (type === 'fixed' && totalUsd > 0 && num >= totalUsd) {
      setErrorMsg('El descuento no puede igualar o superar el total')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    try {
      await onApply(pct, pinStr)
      onClose()
    } catch (err) {
      if (err instanceof Error && (err as Error & { status?: number }).status === 429) {
        setRateLimited(true)
        setErrorMsg('')
      } else {
        setErrorMsg('PIN incorrecto. Intenta de nuevo.')
        triggerShake()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Descuento con autorización"
      size="sm"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || num <= 0 || !pinFull || rateLimited}
          >
            {isLoading ? 'Verificando…' : 'Aplicar descuento'}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {/* Type toggle — same pattern as CargoModal */}
        <div className={styles.typeToggle}>
          <button
            type="button"
            className={`${styles.typeBtn}${type === 'pct' ? ` ${styles.typeBtnActive}` : ''}`}
            onClick={() => { setType('pct'); setValue(''); setErrorMsg('') }}
            disabled={isLoading}
          >
            Porcentaje (%)
          </button>
          <button
            type="button"
            className={`${styles.typeBtn}${type === 'fixed' ? ` ${styles.typeBtnActive}` : ''}`}
            onClick={() => { setType('fixed'); setValue(''); setErrorMsg('') }}
            disabled={isLoading}
          >
            Monto fijo ($)
          </button>
        </div>

        {/* Value input */}
        <div className={styles.inputWrapper}>
          <span className={styles.prefix}>{type === 'pct' ? '%' : '$'}</span>
          <input
            type="number"
            inputMode="decimal"
            className={styles.valueInput}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min="0"
            step="0.01"
            autoFocus
            aria-label={type === 'pct' ? 'Porcentaje de descuento' : 'Monto del descuento en USD'}
          />
        </div>

        {num > 0 && totalUsd > 0 && (
          <div className={styles.previewRow}>
            <span>Descuento en subtotal</span>
            <span className={styles.previewAmt}>−${previewUsd.toFixed(2)}</span>
          </div>
        )}

        {/* PIN */}
        <div className={styles.pinSection}>
          <span className={styles.pinLabel}>PIN de autorización (4 dígitos)</span>
          <div className={`${styles.pinBoxes}${shaking ? ` ${styles.shake}` : ''}`}>
            {pin.map((d, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                className={`${styles.pinBox}${pinError ? ` ${styles.pinBoxError}` : ''}`}
                value={d}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handlePinKeyDown(i, e)}
                aria-label={`Dígito ${i + 1} del PIN`}
                disabled={isLoading || rateLimited}
              />
            ))}
          </div>

          {errorMsg && !rateLimited && (
            <p className={styles.errorMsg}>{errorMsg}</p>
          )}
          {rateLimited && (
            <p className={styles.rateLimitMsg}>
              Demasiados intentos. Espera 5 minutos e intenta de nuevo.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
