'use client'

import { useState } from 'react'
import { CreditCard, Pencil } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'
import { CreditoModal } from './CreditoModal'
import { SuccessTicketPanel } from './SuccessTicketPanel'
import type { SaleItemForPanel } from './SuccessTicketPanel'
import type { CreditTerms } from './CreditoModal'
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
  clientId?: number | null
  items: SaleItemForPanel[]
  businessName: string
}

interface MixedEntry {
  method: PaymentMethod
  amountBs: string
  reference: string
}

const REFERENCE_TYPES = new Set(['pago_movil', 'zelle', 'transfer', 'binance'])
const USD_TYPES        = new Set(['zelle', 'binance', 'binance_usdt', 'efectivo_usd', 'usdt'])
const isUsd = (type: string) =>
  USD_TYPES.has(type) || type.endsWith('_usd') || type.endsWith('_usdt')

export function CobroModal({
  open, onClose, totals, paymentMethods, onConfirm, rate, clientId,
  items, businessName,
}: CobroModalProps) {
  const { toast } = useToast()

  /* ── payment mode ── */
  const [isMixed, setIsMixed]               = useState(false)
  const [loading, setLoading]               = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [reference, setReference]           = useState('')
  const [receivedBs, setReceivedBs]         = useState('')
  const [changeMode, setChangeMode]         = useState<'bs' | 'usd'>('bs')
  const [mixedEntries, setMixedEntries]     = useState<MixedEntry[]>([])
  const [saleResult, setSaleResult]         = useState<SaleResult | null>(null)

  /* ── BUG-01b: per-method rate ── */
  const [methodRate, setMethodRate]   = useState(rate)
  const [editingRate, setEditingRate] = useState(false)
  const [rateStr, setRateStr]         = useState(String(Math.round(rate)))

  /* ── B2: credit modal ── */
  const [showCreditoModal, setShowCreditoModal] = useState(false)
  const [creditTerms, setCreditTerms]           = useState<CreditTerms | null>(null)

  /* ── Sale snapshot for SuccessTicketPanel ── */
  const [snapItems,         setSnapItems]         = useState<SaleItemForPanel[]>([])
  const [snapPaymentMethod, setSnapPaymentMethod] = useState('')
  const [snapDueDate,       setSnapDueDate]       = useState<string | null>(null)

  const { total_bs: totalBs, total_usd: totalUsd } = totals

  /* ── Derived: BUG-01 vuelto ── */
  const effectiveRate = selectedMethod && isUsd(selectedMethod.type) ? methodRate : rate
  const receivedNum   = changeMode === 'bs'
    ? parseFloat(receivedBs) || 0
    : (parseFloat(receivedBs) || 0) * effectiveRate
  const hasInput   = receivedBs !== '' && parseFloat(receivedBs) > 0
  const vueltoBs   = Math.max(0, receivedNum - totalBs)
  const vueltoUsd  = effectiveRate > 0 ? vueltoBs / effectiveRate : 0
  const faltaBs    = hasInput ? Math.max(0, totalBs - receivedNum) : 0
  const isCovered  = !hasInput || receivedNum >= totalBs - 0.01

  /* ── Mixed derived ── */
  const mixedTotal  = mixedEntries.reduce((s, e) => s + (parseFloat(e.amountBs) || 0), 0)
  const mixedDiff   = totalBs - mixedTotal
  const mixedOk     = mixedTotal >= totalBs
  const mixedRefOk  = !mixedEntries.some(
    e => REFERENCE_TYPES.has(e.method.type) && !e.reference.trim()
  )

  const singleRefRequired = !isMixed && selectedMethod != null && REFERENCE_TYPES.has(selectedMethod.type)
  const singleRefOk       = !singleRefRequired || reference.trim() !== ''

  const canConfirm = isMixed
    ? mixedOk && mixedRefOk
    : !!selectedMethod && singleRefOk

  /* ── Handlers ── */

  const handleReset = () => {
    setIsMixed(false); setSelectedMethod(null); setReference('')
    setReceivedBs(''); setMixedEntries([])
    setMethodRate(rate); setEditingRate(false); setRateStr(String(Math.round(rate)))
    setShowCreditoModal(false); setCreditTerms(null)
    setSaleResult(null)
    setSnapItems([]); setSnapPaymentMethod(''); setSnapDueDate(null)
    onClose()
  }

  const handleSelectMethod = (m: PaymentMethod) => {
    setSelectedMethod(m)
    setCreditTerms(null)
    if (isUsd(m.type)) {
      setChangeMode('usd')
      setMethodRate(rate)
      setRateStr(String(Math.round(rate)))
    } else if (m.type !== 'credit') {
      setChangeMode('bs')
    }
    setReceivedBs('')
  }

  const handleRateBlur = () => {
    const parsed = parseFloat(rateStr)
    if (parsed > 0) setMethodRate(parsed)
    else setRateStr(String(Math.round(rate)))
    setEditingRate(false)
  }

  const buildSingle = (): PaymentInput[] => {
    if (!selectedMethod) return []
    if (isUsd(selectedMethod.type)) {
      const usdAmt = parseFloat(receivedBs) || totalUsd
      return [{
        payment_method_id: selectedMethod.id,
        amount_usd: usdAmt,
        amount_bs:  Math.round(usdAmt * methodRate * 100) / 100,
        reference:  reference || undefined,
      }]
    }
    const amtBs = parseFloat(receivedBs) || totalBs
    return [{
      payment_method_id: selectedMethod.id,
      amount_bs:  amtBs,
      amount_usd: Math.round(amtBs / rate * 100) / 100,
      reference:  reference || undefined,
    }]
  }

  const buildMixed = (): PaymentInput[] =>
    mixedEntries
      .filter((e) => parseFloat(e.amountBs) > 0)
      .map((e) => ({
        payment_method_id: e.method.id,
        amount_bs:  parseFloat(e.amountBs),
        amount_usd: Math.round(parseFloat(e.amountBs) / rate * 100) / 100,
        reference:  e.reference || undefined,
      }))

  const doConfirm = async (payments: PaymentInput[]) => {
    /* Snapshot sale data before onConfirm clears the ticket */
    const pmName = isMixed
      ? mixedEntries.filter(e => parseFloat(e.amountBs) > 0).map(e => e.method.name).join(' + ')
      : selectedMethod?.name ?? ''
    setSnapItems([...items])
    setSnapPaymentMethod(pmName)
    setSnapDueDate(
      creditTerms?.due_date
        ? creditTerms.due_date.toISOString().slice(0, 10)
        : null
    )

    setLoading(true)
    try {
      const result = await onConfirm(payments)
      setSaleResult(result)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al procesar el pago', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedMethod?.type === 'credit' && !isMixed) {
      if (!clientId) { toast('Selecciona un cliente antes de vender a crédito', 'warning'); return }
      setShowCreditoModal(true)
      return
    }
    if (isMixed) {
      const missingRef = mixedEntries.find(
        (e) => parseFloat(e.amountBs) > 0 && REFERENCE_TYPES.has(e.method.type) && !e.reference.trim()
      )
      if (missingRef) {
        toast(`Ingresa la referencia para ${missingRef.method.name}`, 'warning')
        return
      }
    }
    const payments = isMixed ? buildMixed() : buildSingle()
    if (!payments.length) { toast('Selecciona un método de pago', 'warning'); return }
    await doConfirm(payments)
  }

  const handleCreditoConfirm = async (terms: CreditTerms) => {
    setCreditTerms(terms)
    setShowCreditoModal(false)
    await doConfirm(buildSingle())
  }

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

  const isUsdMethod = selectedMethod ? isUsd(selectedMethod.type) : false

  return (
    <>
      {/* ── Success panel — rendered outside Modal, full-screen overlay ── */}
      {saleResult && (
        <SuccessTicketPanel
          sale={{
            id:             saleResult.id,
            ticket_number:  saleResult.ticket_number,
            status:         saleResult.status,
            total_usd:      saleResult.total_usd,
            total_bs:       saleResult.total_bs,
            due_date:       snapDueDate,
            payment_method: snapPaymentMethod,
            rate:           rate,
            items:          snapItems,
          }}
          businessName={businessName}
          onClose={handleReset}
        />
      )}

      <Modal
        open={open && !saleResult}
        onClose={handleReset}
        title="Procesar Pago"
        size="md"
        footer={
          <div className={styles.footer}>
            <Button variant="ghost" onClick={handleReset}>Cancelar</Button>
            <Button variant="primary" onClick={handleConfirm} loading={loading} disabled={!canConfirm}>
              {selectedMethod?.type === 'credit' && !creditTerms
                ? 'Configurar crédito →'
                : 'Confirmar Venta'}
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
              <span className={styles.ivaLine}>IVA incl. ${totals.iva_usd.toFixed(2)}</span>
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
              {/* Methods grid */}
              <div className={styles.methodsGrid}>
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    className={`${styles.methodCard} ${selectedMethod?.id === m.id ? styles.methodActive : ''}`}
                    onClick={() => handleSelectMethod(m)}
                    type="button"
                  >
                    <CreditCard size={18} aria-hidden="true" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>

              {/* Credit summary (after CreditoModal confirmed) */}
              {creditTerms && selectedMethod?.type === 'credit' && (
                <div className={styles.creditSummary}>
                  <span className={styles.creditSummaryLabel}>Crédito a {creditTerms.credit_days} días</span>
                  <span className={styles.creditSummaryDue}>
                    Vence:{' '}
                    {creditTerms.due_date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Change / vuelto — only for non-credit methods */}
              {selectedMethod?.type !== 'credit' && (
                <div className={styles.changeSection}>
                  {/* Bs / USD toggle — hide for USD methods (already in USD mode) */}
                  {!isUsdMethod && (
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
                  )}

                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.receivedInput}
                    placeholder={isUsdMethod ? totalUsd.toFixed(2) : changeMode === 'bs' ? totalBs.toFixed(2) : totalUsd.toFixed(2)}
                    value={receivedBs}
                    onChange={(e) => setReceivedBs(e.target.value)}
                    aria-label={isUsdMethod ? 'Monto recibido (USD)' : 'Monto recibido'}
                  />

                  {/* BUG-01b: inline rate for USD methods */}
                  {isUsdMethod && (
                    <div className={styles.rateRow}>
                      <span className={styles.rateLabel}>Tasa</span>
                      {editingRate ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className={styles.rateInput}
                          value={rateStr}
                          onChange={(e) => {
                            setRateStr(e.target.value)
                            const p = parseFloat(e.target.value)
                            if (p > 0) setMethodRate(p)
                          }}
                          onBlur={handleRateBlur}
                          autoFocus
                          step="0.01"
                          min="1"
                          aria-label="Tasa de cambio"
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.rateValue}
                          onClick={() => setEditingRate(true)}
                          aria-label="Editar tasa de cambio"
                        >
                          {methodRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <Pencil size={11} aria-hidden="true" />
                        </button>
                      )}
                      {hasInput && (
                        <span className={styles.rateBsEquiv}>
                          = Bs.&nbsp;{(parseFloat(receivedBs) * methodRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* BUG-01: vuelto / falta */}
                  {hasInput && isCovered && vueltoBs > 0.01 && (
                    <div className={styles.vueltoBox}>
                      <span className={styles.vueltoLabel}>Vuelto</span>
                      <div className={styles.vueltoAmts}>
                        <span className={styles.vueltoMonto}>${vueltoUsd.toFixed(2)}</span>
                        <span className={styles.vueltoBs}>Bs. {vueltoBs.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  {hasInput && !isCovered && faltaBs > 0.01 && (
                    <div className={styles.faltaBox}>
                      <span>Falta por cubrir</span>
                      <span className={styles.faltaMonto}>Bs. {faltaBs.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reference field — obligatoria para REFERENCE_TYPES */}
              {selectedMethod && REFERENCE_TYPES.has(selectedMethod.type) && (
                <div className={styles.referenceField}>
                  <label className={styles.fieldLabel}>
                    Referencia <span className={styles.requiredMark} aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    className={`${styles.textInput} ${!reference.trim() ? styles.inputRequired : ''}`}
                    placeholder="Número de confirmación o referencia"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={60}
                    required
                    aria-required="true"
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
                            type="text"
                            inputMode="decimal"
                            className={styles.mixedAmountInput}
                            placeholder="Bs."
                            value={entry.amountBs}
                            onChange={(e) => updateEntry(m.id, 'amountBs', e.target.value)}
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

      {/* B2: CreditoModal — z-modal-top so it renders above CobroModal */}
      <CreditoModal
        open={showCreditoModal}
        onClose={() => setShowCreditoModal(false)}
        onConfirm={handleCreditoConfirm}
        totalUsd={totalUsd}
      />
    </>
  )
}
