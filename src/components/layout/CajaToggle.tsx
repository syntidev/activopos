'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Store, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useCaja } from '@/context/CajaContext'
import styles from './CajaToggle.module.css'

function getElapsed(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime()
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

interface CajaToggleProps {
  /** Rail contraído (64px desktop o 56px tablet) — oculta el label, solo ícono */
  collapsed?: boolean
}

export function CajaToggle({ collapsed = false }: CajaToggleProps) {
  const router = useRouter()
  const { toast } = useToast()
  // CajaContext es la única fuente — antes este componente tenía su propio
  // fetch y el pill del header no se enteraba al abrir la caja desde aquí.
  const { isOpen: cajaOpen, register, refreshCaja } = useCaja()
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [opening, setOpening] = useState(false)
  const [elapsed, setElapsed] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useScrollLock(modalOpen)

  // Update elapsed on mount and every 30s while open
  useEffect(() => {
    if (!register) { setElapsed(''); return }
    setElapsed(getElapsed(register.openedAt))
    const id = setInterval(() => setElapsed(getElapsed(register.openedAt)), 30_000)
    return () => clearInterval(id)
  }, [register])

  // Focus input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [modalOpen])

  const handleToggleClick = () => {
    if (cajaOpen === null) return
    if (cajaOpen) {
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
        await refreshCaja()
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string }
        toast(body.error ?? 'Error al abrir la caja', 'error')
      }
    } catch { toast('Error de conexión al abrir la caja', 'error') }
    finally { setOpening(false) }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setModalOpen(false)
  }

  if (cajaOpen === null) return null

  const isOpen = cajaOpen

  return (
    <>
      {/* Separator lives here so it mounts/unmounts with the toggle */}
      <div className={styles.separator} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.toggle} ${isOpen ? styles.toggleOpen : styles.toggleClosed} ${collapsed ? styles.toggleCollapsed : ''}`}
        onClick={handleToggleClick}
        aria-label={isOpen
          ? 'Caja abierta — ir a caja para cerrar'
          : 'Caja cerrada — abrir caja'}
        title={collapsed
          ? (isOpen ? `Abierta hace ${elapsed}` : 'Caja cerrada')
          : (isOpen && register
            ? `Abierta por ${register.cashierName}`
            : 'Abrir caja')}
      >
        <Store size={14} strokeWidth={2} aria-hidden="true" />
        {!collapsed && (isOpen ? (
          <span className={styles.toggleLabel}>Abierta hace {elapsed}</span>
        ) : (
          <span className={styles.toggleLabel}>Caja cerrada</span>
        ))}
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
