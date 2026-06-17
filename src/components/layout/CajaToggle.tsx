'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Store, X } from 'lucide-react'
import styles from './CajaToggle.module.css'

interface RegisterInfo {
  openedAt: string
  cashierName: string
}

type CajaStatus =
  | { isOpen: false }
  | { isOpen: true; register: RegisterInfo }

interface StatusResponse {
  isOpen: boolean
  register?: RegisterInfo
}

function getElapsed(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime()
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function CajaToggle() {
  const router = useRouter()
  const [status, setStatus] = useState<CajaStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [opening, setOpening] = useState(false)
  const [elapsed, setElapsed] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cash/status')
      if (!res.ok) return
      const data = await res.json() as StatusResponse
      if (data.isOpen && data.register) {
        setStatus({ isOpen: true, register: data.register })
        setElapsed(getElapsed(data.register.openedAt))
      } else {
        setStatus({ isOpen: false })
      }
    } catch { /* silently fail — caja toggle is non-critical */ }
  }, [])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  // Update elapsed every 30s when open
  useEffect(() => {
    if (!status?.isOpen) return
    const reg = (status as { isOpen: true; register: RegisterInfo }).register
    const id = setInterval(() => setElapsed(getElapsed(reg.openedAt)), 30_000)
    return () => clearInterval(id)
  }, [status])

  // Focus input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [modalOpen])

  const handleToggleClick = () => {
    if (!status) return
    if (status.isOpen) {
      router.push('/caja')
    } else {
      setAmount('')
      setModalOpen(true)
    }
  }

  const handleOpen = async () => {
    const bs = parseFloat(amount)
    if (isNaN(bs) || bs <= 0) return
    setOpening(true)
    try {
      const res = await fetch('/api/cash/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount_bs: bs, opening_amount_usd: 0 }),
      })
      if (res.ok) {
        setModalOpen(false)
        await fetchStatus()
      }
    } catch { /* silently fail — caja toggle is non-critical */ }
    finally { setOpening(false) }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setModalOpen(false)
  }

  if (!status) return null

  const isOpen = status.isOpen

  return (
    <>
      <button
        type="button"
        className={`${styles.toggle} ${isOpen ? styles.toggleOpen : styles.toggleClosed}`}
        onClick={handleToggleClick}
        aria-label={isOpen
          ? 'Caja abierta — ir a caja para cerrar'
          : 'Caja cerrada — abrir caja'}
        title={isOpen
          ? `Abierta por ${(status as { isOpen: true; register: RegisterInfo }).register.cashierName}`
          : 'Abrir caja'}
      >
        <Store size={14} strokeWidth={2} aria-hidden="true" />
        {isOpen ? (
          <span className={styles.toggleLabel}>Abierta hace {elapsed}</span>
        ) : (
          <span className={styles.toggleLabel}>Caja cerrada</span>
        )}
      </button>

      {modalOpen && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Abrir caja"
          onClick={handleOverlayClick}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Abrir Caja</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.modalBody}>
              <label className={styles.fieldLabel} htmlFor="caja-opening-amount">
                Monto inicial en Bs.
              </label>
              <input
                ref={inputRef}
                id="caja-opening-amount"
                type="number"
                min="0.01"
                step="0.01"
                className={styles.amountInput}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleOpen() }}
                placeholder="0.00"
              />
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setModalOpen(false)}
                disabled={opening}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => void handleOpen()}
                disabled={opening || amount === ''}
              >
                {opening ? 'Abriendo…' : 'Abrir caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
