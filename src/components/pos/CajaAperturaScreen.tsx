'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import styles from './CajaApertura.module.css'

interface CajaAperturaScreenProps {
  onOpen: (data: { opening_amount_usd: number; opening_amount_bs: number }) => Promise<void>
}

export function CajaAperturaScreen({ onOpen }: CajaAperturaScreenProps) {
  const { toast } = useToast()
  const [amountUsd, setAmountUsd] = useState('')
  const [amountBs, setAmountBs] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onOpen({
        opening_amount_usd: parseFloat(amountUsd) || 0,
        opening_amount_bs: parseFloat(amountBs) || 0,
      })
      toast('Caja abierta. ¡Buen turno!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al abrir la caja', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <Lock size={32} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>Caja Cerrada</h1>
        <p className={styles.subtitle}>
          Establece el fondo inicial para comenzar el turno
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fond-usd">
              Fondo Inicial (USD)
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.prefix}>$</span>
              <input
                id="fond-usd"
                type="number"
                className={styles.input}
                placeholder="0.00"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="fond-bs">
              Fondo Inicial (Bs.)
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.prefix}>Bs.</span>
              <input
                id="fond-bs"
                type="number"
                className={styles.input}
                placeholder="0.00"
                value={amountBs}
                onChange={(e) => setAmountBs(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
          >
            Iniciar Turno y Abrir Caja
          </Button>
        </form>

        <Link href="/caja" className={styles.historyLink}>
          Historial de cierres
        </Link>
      </div>
    </div>
  )
}
