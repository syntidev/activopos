'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { dual } from './money'
import type { ApiErrorBody } from './pago'
import styles from './CobrarPedidoModal.module.css'
import d from './PedidoPago.module.css'

interface PaymentMethod { id: number; name: string; is_active: boolean; is_financing?: boolean }

interface DebtResult { saldo_usd: number; pagada: boolean }

interface CobrarDeudaModalProps {
  open:   boolean
  order:  { id: number; order_number: string } | null
  /** Deuda del cliente por el Cashea rechazado (pago.deuda_cliente_usd). */
  saldoUsd: number
  rate:   number
  onClose: () => void
  /** El abono quedó registrado: el padre refresca el tablero. */
  onDone: () => void
}

const toNum = (s: string): number => Number(s.trim().replace(',', '.'))

/** Cobra (total o parcial) la deuda de un Cashea rechazado ya cobrado: abono sobre la venta original, con un método real y la caja abierta. */
export function CobrarDeudaModal({ open, order, saldoUsd, rate, onClose, onDone }: CobrarDeudaModalProps) {
  const [methods, setMethods]   = useState<PaymentMethod[]>([])
  const [method, setMethod]     = useState<number | null>(null)
  const [monto, setMonto]       = useState('')
  const [notas, setNotas]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<{ message: string; saldo?: number } | null>(null)
  const [result, setResult]     = useState<DebtResult | null>(null)

  useEffect(() => {
    if (!open) { setMethod(null); setMonto(''); setNotas(''); setBusy(false); setError(null); setResult(null); return }
    setMonto(saldoUsd.toFixed(2))
    fetch('/api/payment-methods')
      .then(r => r.json() as Promise<{ methods?: PaymentMethod[] }>)
      .then(j => {
        const reales = (j.methods ?? []).filter(m => m.is_active && !m.is_financing)
        setMethods(reales)
        if (reales.length > 0) setMethod(reales[0].id)
      })
      .catch(() => {})
  }, [open, saldoUsd])

  const montoNum = toNum(monto)
  const montoOk  = Number.isFinite(montoNum) && montoNum > 0
  const puede    = !!order && method !== null && montoOk && !busy

  const confirmar = async (): Promise<void> => {
    if (!order || method === null || !montoOk) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/cobrar-deuda-financiamiento`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_method_id: method, amount_usd: Math.round(montoNum * 100) / 100, ...(notas.trim() ? { notes: notas.trim() } : {}) }),
      })
      const body = await res.json().catch(() => null) as (ApiErrorBody & Partial<DebtResult>) | null
      if (res.ok && body && typeof body.saldo_usd === 'number') {
        setResult({ saldo_usd: body.saldo_usd, pagada: body.pagada === true })
        onDone()
        return
      }
      // 409 NO_DEBT / NO_OPEN_REGISTER, 422 AMOUNT_EXCEEDS_DEBT (trae el saldo) / INVALID_METHOD: el mensaje del servidor tal cual.
      setError({ message: body?.error ?? 'No se pudo cobrar la deuda.', saldo: body?.code === 'AMOUNT_EXCEEDS_DEBT' ? body.saldo_usd : undefined })
    } catch {
      setError({ message: 'Error de conexión. Intenta de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  const footer = result ? (
    <Button variant="primary" size="md" onClick={onClose}>Listo</Button>
  ) : (
    <>
      <Button variant="ghost" size="md" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button variant="primary" size="md" onClick={() => { void confirmar() }} disabled={!puede} loading={busy} data-testid="deuda-confirmar">Cobrar deuda</Button>
    </>
  )

  return (
    <Modal open={open && order !== null} onClose={() => { if (!busy) onClose() }} title={order ? `Cobrar deuda de Cashea · ${order.order_number}` : 'Cobrar deuda'} size="md" footer={footer}>
      <div className={d.cuerpo} data-testid="deuda-modal">
        <div className={d.saldoCashea}>
          <span>Deuda del cliente (Cashea rechazado)</span>
          <strong data-testid="deuda-saldo">{dual(saldoUsd, rate)}</strong>
        </div>

        {result ? (
          <p className={d.exito} role="status" data-testid="deuda-resultado">
            {result.pagada ? 'Deuda saldada.' : `Abono registrado. Saldo restante: ${dual(result.saldo_usd, rate)}`}
          </p>
        ) : (
          <>
            <div className={d.campo}>
              <span className={d.etiqueta}>Método de pago</span>
              <div className={styles.methods} role="radiogroup" aria-label="Método de pago">
                {methods.map(m => (
                  <button key={m.id} type="button" role="radio" aria-checked={method === m.id}
                    className={`${styles.methodBtn} ${method === m.id ? styles.methodBtnActive : ''}`} onClick={() => setMethod(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={d.campo}>
              <label className={d.etiqueta} htmlFor="deuda-monto">Monto a cobrar (USD)</label>
              <input id="deuda-monto" type="text" inputMode="decimal" autoComplete="off" className={d.entrada} value={monto}
                onChange={e => { setMonto(e.target.value); setError(null) }} data-testid="deuda-monto" />
              {montoOk && <span className={d.etiqueta} data-testid="deuda-monto-bs">{dual(montoNum, rate)}</span>}
            </div>

            <div className={d.campo}>
              <label className={d.etiqueta} htmlFor="deuda-notas">Notas <span>(opcional)</span></label>
              <textarea id="deuda-notas" className={d.texto} value={notas} onChange={e => setNotas(e.target.value)} maxLength={500} />
            </div>

            {error && (
              <div className={d.campo}>
                <p className={d.errorInline} role="alert" data-testid="deuda-error">{error.message}</p>
                {error.saldo !== undefined && <p className={d.etiqueta} data-testid="deuda-error-saldo">Saldo de la deuda: {dual(error.saldo, rate)}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
