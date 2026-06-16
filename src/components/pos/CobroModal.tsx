'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'
import type { TicketTotals, PaymentInput } from '@/lib/pos'
import type { PaymentMethod } from '@/hooks/usePOS'
import type { SaleResult } from '@/lib/pos'
import styles from './CobroModal.module.css'

interface CobroModalProps {
  open: boolean
  onClose: () => void
  totals: TicketTotals
  paymentMethods: PaymentMethod[]
  onConfirm: (payments: PaymentInput[]) => Promise<SaleResult>
  rate: number
}

interface MixedEntry {
  method: PaymentMethod
  amountBs: string
  reference: string
}

const REFERENCE_TYPES = new Set(['pago_movil', 'zelle', 'transfer', 'binance'])

export function CobroModal({
  open, onClose, totals, paymentMethods, onConfirm, rate,
}: CobroModalProps) {
  const { toast } = useToast()
  const [isMixed, setIsMixed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [reference, setReference] = useState('')
  const [receivedBs, setReceivedBs] = useState('')
  const [changeMode, setChangeMode] = useState<'bs' | 'usd'>('bs')
  const [mixedEntries, setMixedEntries] = useState<MixedEntry[]>([])

  const { total_bs: totalBs, total_usd: totalUsd } = totals

  const receivedNum = changeMode === 'bs'
    ? parseFloat(receivedBs) || 0
    : (parseFloat(receivedBs) || 0) * rate
  const changeBs = Math.max(0, receivedNum - totalBs)

  const mixedTotal = mixedEntries.reduce((s, e) => s + (parseFloat(e.amountBs) || 0), 0)
  const mixedDiff = totalBs - mixedTotal
  const mixedOk = mixedTotal >= totalBs

  const canConfirm = isMixed ? mixedOk : !!selectedMethod

  const handleReset = () => {
    setIsMixed(false); setSelectedMethod(null); setReference('')
    setReceivedBs(''); setMixedEntries([])
    onClose()
  }

  const handleConfirm = async () => {
    const payments = isMixed ? buildMixed() : buildSingle()
    if (!payments.length) { toast('Selecciona un método de pago', 'warning'); return }
    setLoading(true)
    try {
      await onConfirm(payments)
      toast('Venta procesada exitosamente', 'success')
      handleReset()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al procesar el pago', 'error')
    } finally {
      setLoading(false)
    }
  }

  const buildSingle = (): PaymentInput[] => {
    if (!selectedMethod) return []
    const amtBs = parseFloat(receivedBs) || totalBs
    return [{ payment_method_id: selectedMethod.id, amount_bs: amtBs, amount_usd: amtBs / rate, reference: reference || undefined }]
  }

  const buildMixed = (): PaymentInput[] =>
    mixedEntries
      .filter((e) => parseFloat(e.amountBs) > 0)
      .map((e) => ({
        payment_method_id: e.method.id,
        amount_bs: parseFloat(e.amountBs),
        amount_usd: parseFloat(e.amountBs) / rate,
        reference: e.reference || undefined,
      }))

  const toggleMixed = (m: PaymentMethod) =>
    setMixedEntries((prev) => {
      const exists = prev.find((e) => e.method.id === m.id)
      return exists
        ? prev.filter((e) => e.method.id !== m.id)
        : [...prev, { method: m, amountBs: '', reference: '' }]
    })

  const updateEntry = (id: number, field: keyof MixedEntry, val: string) =>
    setMixedEntries((prev) =>
      prev.map((e) => (e.method.id === id ? { ...e, [field]: val } : e))
    )

  return (
    <Modal
      open={open}
      onClose={handleReset}
      title="Procesar Pago"
      size="md"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={handleReset}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading} disabled={!canConfirm}>
            Confirmar Venta
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {/* Total */}
        <div className={styles.totalDisplay}>
          <span className={styles.totalBs}>
            Bs.&nbsp;{totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
          <span className={styles.totalUsd}>${totalUsd.toFixed(2)} USD</span>
          {totals.iva_usd > 0 && (
            <span className={styles.ivaLine}>
              IVA incl. ${totals.iva_usd.toFixed(2)}
            </span>
          )}
        </div>

        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${!isMixed ? styles.modeBtnActive : ''}`}
            onClick={() => setIsMixed(false)}
            type="button"
          >
            Un método
          </button>
          <button
            className={`${styles.modeBtn} ${isMixed ? styles.modeBtnActive : ''}`}
            onClick={() => setIsMixed(true)}
            type="button"
          >
            Pago mixto
          </button>
        </div>

        {!isMixed ? (
          <>
            <div className={styles.methodsGrid}>
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  className={`${styles.methodCard} ${selectedMethod?.id === m.id ? styles.methodActive : ''}`}
                  onClick={() => setSelectedMethod(m)}
                  type="button"
                >
                  <CreditCard size={18} aria-hidden="true" />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>

            {/* Change calculator */}
            <div className={styles.changeSection}>
              <div className={styles.changeCurrencyToggle}>
                <button
                  className={`${styles.currencyBtn} ${changeMode === 'bs' ? styles.currencyActive : ''}`}
                  onClick={() => setChangeMode('bs')}
                  type="button"
                >Bs.</button>
                <button
                  className={`${styles.currencyBtn} ${changeMode === 'usd' ? styles.currencyActive : ''}`}
                  onClick={() => setChangeMode('usd')}
                  type="button"
                >USD</button>
              </div>
              <input
                type="number"
                className={styles.receivedInput}
                placeholder={changeMode === 'bs' ? totalBs.toFixed(2) : totalUsd.toFixed(2)}
                value={receivedBs}
                onChange={(e) => setReceivedBs(e.target.value)}
                min="0"
                step="0.01"
                aria-label="Monto recibido"
              />
              {changeBs > 0 && (
                <div className={styles.changeRow}>
                  <span>Cambio</span>
                  <strong>Bs.&nbsp;{changeBs.toFixed(2)}</strong>
                  <span className={styles.changeUsd}>/ ${(changeBs / rate).toFixed(2)}</span>
                </div>
              )}
            </div>

            {selectedMethod && REFERENCE_TYPES.has(selectedMethod.type) && (
              <div className={styles.referenceField}>
                <label className={styles.fieldLabel}>Referencia</label>
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder="Número de confirmación o referencia"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.mixedList}>
              {paymentMethods.map((m) => {
                const entry = mixedEntries.find((e) => e.method.id === m.id)
                return (
                  <div key={m.id} className={`${styles.mixedRow} ${entry ? styles.mixedRowActive : ''}`}>
                    <button
                      className={styles.mixedToggleBtn}
                      onClick={() => toggleMixed(m)}
                      aria-pressed={!!entry}
                      type="button"
                    >
                      <CreditCard size={15} aria-hidden="true" />
                      <span>{m.name}</span>
                    </button>
                    {entry && (
                      <div className={styles.mixedInputs}>
                        <input
                          type="number"
                          className={styles.mixedAmountInput}
                          placeholder="Bs."
                          value={entry.amountBs}
                          onChange={(e) => updateEntry(m.id, 'amountBs', e.target.value)}
                          min="0"
                          step="0.01"
                          aria-label={`Monto en Bs. para ${m.name}`}
                        />
                        {REFERENCE_TYPES.has(m.type) && (
                          <input
                            type="text"
                            className={styles.mixedRefInput}
                            placeholder="Referencia"
                            value={entry.reference}
                            onChange={(e) => updateEntry(m.id, 'reference', e.target.value)}
                            maxLength={30}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className={`${styles.mixedStatus} ${mixedOk ? styles.mixedStatusOk : styles.mixedStatusPending}`}>
              {mixedDiff > 0
                ? `Faltan Bs. ${mixedDiff.toFixed(2)}`
                : `Cubierto${Math.abs(mixedDiff) > 0.01 ? ` · Vuelto Bs. ${Math.abs(mixedDiff).toFixed(2)}` : ''}`}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
