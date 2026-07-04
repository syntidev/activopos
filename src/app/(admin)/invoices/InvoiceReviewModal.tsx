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

export function InvoiceReviewModal({ invoiceId, invoiceLabel, action, onClose, onDone }: Props) {
  const { toast } = useToast()
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, notes }),
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
