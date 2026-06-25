'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Input, useToast } from '@/components/ui'
import styles from './AbonoModal.module.css'

interface PaymentMethod { id: number; name: string; type: string }

export interface SaleForAbono {
  id:            number
  ticket_number: string
  client_name:   string
  total_usd:     number
  abonado_usd:   number
}

interface AbonoModalProps {
  open:      boolean
  onClose:   () => void
  sale:      SaleForAbono | null
  rate:      number
  onSuccess: () => void
}

export function AbonoModal({ open, onClose, sale, rate, onSuccess }: AbonoModalProps) {
  const { toast }   = useToast()
  const [methods, setMethods]     = useState<PaymentMethod[]>([])
  const [pmId, setPmId]           = useState<number | null>(null)
  const [amountUsd, setAmountUsd] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading]     = useState(false)

  const saldo     = sale ? Math.max(0, Math.round((sale.total_usd - sale.abonado_usd) * 100) / 100) : 0
  const amountNum = parseFloat(amountUsd) || 0
  const amountBs  = amountNum * rate

  useEffect(() => {
    if (!open) return
    setAmountUsd(saldo > 0 ? saldo.toFixed(2) : '')
    setReference('')
    fetch('/api/payment-methods')
      .then(r => r.json())
      .then(j => {
        const ms: PaymentMethod[] = j.methods ?? []
        setMethods(ms)
        if (ms.length && !pmId) setPmId(ms[0].id)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSubmit = async () => {
    if (!sale || !pmId || amountNum <= 0) return

    // FIX 1 — client-side saldo guard
    if (amountNum > saldo + 0.01) {
      toast('El abono no puede superar el saldo pendiente: $' + saldo.toFixed(2), 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/ventas/${sale.id}/abono`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // FIX 3 — server calculates amount_bs; don't send it from client
        body: JSON.stringify({
          payment_method_id: pmId,
          amount_usd:        amountNum,
          reference:         reference || undefined,
        }),
      })
      if (res.ok) {
        toast('Abono registrado exitosamente', 'success')
        onSuccess()
        onClose()
      } else {
        // FIX 2 — specific message when caja is closed
        const msg = await res.json().then((j: { error?: string }) => j.error ?? 'Error al registrar abono')
        if (msg.includes('caja')) {
          toast('Abre la caja primero para registrar abonos', 'error')
        } else {
          toast(msg, 'error')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  if (!sale) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Abonar · ${sale.ticket_number}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !pmId || amountNum <= 0 || amountNum > saldo + 0.01}
          >
            {loading ? 'Procesando...' : 'Registrar abono'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.saleInfo}>
          <div className={styles.infoRow}><span>Cliente</span><strong>{sale.client_name}</strong></div>
          <div className={styles.infoRow}><span>Total factura</span><strong>${sale.total_usd.toFixed(2)}</strong></div>
          <div className={styles.infoRow}><span>Abonado</span><strong>${sale.abonado_usd.toFixed(2)}</strong></div>
          <div className={`${styles.infoRow} ${styles.infoRowSaldo}`}>
            <span>Saldo pendiente</span>
            <strong className={styles.saldoValue}>${saldo.toFixed(2)}</strong>
          </div>
        </div>

        {methods.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Método de pago</label>
            <div className={styles.methodGrid}>
              {methods.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.methodBtn} ${pmId === m.id ? styles.methodBtnActive : ''}`}
                  onClick={() => setPmId(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Monto a abonar (USD)</label>
          <Input
            value={amountUsd}
            onChange={e => setAmountUsd(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
          />
          {amountBs > 0 && rate > 0 && (
            <p className={styles.conversion}>
              ≈ Bs {amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Referencia (opcional)</label>
          <Input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Nro. de referencia o confirmación"
            maxLength={100}
          />
        </div>
      </div>
    </Modal>
  )
}
