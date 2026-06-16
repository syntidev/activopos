'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import styles from './MovimientoModal.module.css'

export interface PaymentMethod {
  id: number
  name: string
  type: string
}

interface MovimientoModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  rate: number
  paymentMethods: PaymentMethod[]
}

type Currency = 'usd' | 'bs'
type MovType = 'in' | 'out'

export function MovimientoModal({
  open,
  onClose,
  onSaved,
  rate,
  paymentMethods,
}: MovimientoModalProps) {
  const [currency, setCurrency] = useState<Currency>('usd')
  const [type, setType]         = useState<MovType>('out')
  const [amount, setAmount]     = useState('')
  const [concept, setConcept]   = useState('')
  const [pmId, setPmId]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const safeRate = rate > 0 ? rate : 36.5
  const numAmount = parseFloat(amount) || 0

  const amount_usd = currency === 'usd' ? numAmount : numAmount / safeRate
  const amount_bs  = currency === 'bs'  ? numAmount : numAmount * safeRate

  const preview =
    numAmount > 0
      ? currency === 'usd'
        ? `≈ Bs ${amount_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a tasa ${safeRate.toFixed(2)}`
        : `≈ $ ${amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a tasa ${safeRate.toFixed(2)}`
      : ''

  const reset = () => {
    setAmount('')
    setConcept('')
    setPmId('')
    setError('')
    setCurrency('usd')
    setType('out')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!amount || numAmount <= 0) { setError('Ingresa un monto válido'); return }
    if (!concept.trim() || concept.trim().length < 3) { setError('El concepto debe tener al menos 3 caracteres'); return }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/cash/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount_usd: Math.round(amount_usd * 10000) / 10000,
          amount_bs: Math.round(amount_bs * 100) / 100,
          concept: concept.trim(),
          ...(pmId ? { payment_method_id: parseInt(pmId, 10) } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        return
      }

      reset()
      onSaved()
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo Movimiento"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            Guardar
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        {/* Currency toggle */}
        <div>
          <p className={styles.sectionLabel}>Moneda</p>
          <div className={styles.currencyToggle}>
            <button
              type="button"
              className={`${styles.currencyBtn} ${currency === 'usd' ? styles.currencyBtnActive : ''}`}
              onClick={() => setCurrency('usd')}
            >
              Dólares (USD)
            </button>
            <button
              type="button"
              className={`${styles.currencyBtn} ${currency === 'bs' ? styles.currencyBtnActive : ''}`}
              onClick={() => setCurrency('bs')}
            >
              Bolívares (VES)
            </button>
          </div>
        </div>

        {/* Type */}
        <div>
          <p className={styles.sectionLabel}>Tipo de movimiento</p>
          <div className={styles.typeRow}>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === 'in' ? styles.typeBtnIn : ''}`}
              onClick={() => setType('in')}
            >
              <ArrowDownLeft size={16} aria-hidden="true" />
              Ingreso / Entrada
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === 'out' ? styles.typeBtnOut : ''}`}
              onClick={() => setType('out')}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
              Retiro / Salida
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className={styles.amountRow}>
          <Input
            label={currency === 'usd' ? 'Monto (USD)' : 'Monto (Bs)'}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            leftIcon={<DollarSign size={14} aria-hidden="true" />}
            placeholder="0.00"
          />
          {preview && <p className={styles.amountPreview}>{preview}</p>}
        </div>

        {/* Concept */}
        <Input
          label="Concepto"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Pago proveedor, comprar hielo, vuelto..."
          error={error || undefined}
        />

        {/* Payment method */}
        {paymentMethods.length > 0 && (
          <div className={styles.selectField}>
            <label htmlFor="movimiento-pm" className={styles.selectLabel}>
              Método de pago <span style={{ color: 'var(--color-text-muted)' }}>(opcional)</span>
            </label>
            <select
              id="movimiento-pm"
              className={styles.select}
              value={pmId}
              onChange={(e) => setPmId(e.target.value)}
            >
              <option value="">Sin especificar</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  )
}
