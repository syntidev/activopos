'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import styles from './invoices.module.css'

interface Props {
  invoiceId:    number
  invoiceLabel: string
  action:       'approve' | 'reject'
  onClose:      () => void
  onDone:       () => void
}

type Plan  = 'gratis' | 'negocio_activo'
type Ciclo = 'mensual' | 'trimestral' | 'semestral' | 'anual'

export function InvoiceReviewModal({ invoiceId, invoiceLabel, action, onClose, onDone }: Props) {
  const { toast } = useToast()
  const [notes, setNotes]           = useState('')
  const [plan, setPlan]             = useState<Plan>('negocio_activo')
  const [ciclo, setCiclo]           = useState<Ciclo>('mensual')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action,
          notes,
          // Al aprobar, el plan/ciclo elegido activa la suscripción del tenant.
          ...(action === 'approve'
            ? { plan, ...(plan === 'negocio_activo' ? { ciclo } : {}) }
            : {}),
        }),
      })
      if (!res.ok) { toast('Error al procesar la factura.', 'error'); return }
      toast(action === 'approve' ? 'Factura aprobada.' : 'Factura rechazada.', 'success')
      onDone()
    } catch {
      toast('Error de conexión.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={action === 'approve' ? 'Aprobar factura' : 'Rechazar factura'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant={action === 'approve' ? 'primary' : 'danger'}
            onClick={() => void handleConfirm()}
            loading={submitting}
          >
            {action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
          </Button>
        </>
      }
    >
      <p className={styles.modalText}>Factura <strong>{invoiceLabel}</strong></p>

      {action === 'approve' && (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="review-plan">Plan a activar</label>
            <select
              id="review-plan"
              className={styles.select}
              value={plan}
              onChange={e => setPlan(e.target.value as Plan)}
            >
              <option value="negocio_activo">Negocio Activo</option>
              <option value="gratis">Gratis</option>
            </select>
          </div>
          {plan === 'negocio_activo' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="review-ciclo">Ciclo de facturación</label>
              <select
                id="review-ciclo"
                className={styles.select}
                value={ciclo}
                onChange={e => setCiclo(e.target.value as Ciclo)}
              >
                <option value="mensual">Mensual ($19 · 1 mes)</option>
                <option value="trimestral">Trimestral ($50 · 3 meses)</option>
                <option value="semestral">Semestral ($90 · 6 meses)</option>
                <option value="anual">Anual ($156 · 12 meses)</option>
              </select>
            </div>
          )}
        </>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="review-notes">Notas (opcional)</label>
        <textarea
          id="review-notes"
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo, referencia adicional, etc."
        />
      </div>
    </Modal>
  )
}
