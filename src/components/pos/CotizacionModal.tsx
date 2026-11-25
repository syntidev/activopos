'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'
import { docFromTicket, openQuotationPrint } from '@/lib/quotation-document'
import { useQuotationMeta } from '@/hooks/useQuotationMeta'
import type { TicketState, TicketTotals, QuoteOptions } from '@/lib/pos'
import type { SaleResult } from '@/lib/pos'
import styles from './CotizacionModal.module.css'

interface CotizacionModalProps {
  open: boolean
  onClose: () => void
  ticket: TicketState
  totals: TicketTotals
  onConfirm: (options?: QuoteOptions) => Promise<SaleResult>
}

export function CotizacionModal({ open, onClose, ticket, totals, onConfirm }: CotizacionModalProps) {
  const { toast } = useToast()
  const [validityDays, setValidityDays] = useState('7')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  // Datos reales del negocio y del usuario (misma fuente que el ticket de venta); sin ellos no se imprime.
  const { meta, error: metaError } = useQuotationMeta(open)

  /** `ticketNumber` = número devuelto al guardar; sin él el documento se rotula "Borrador (sin número)". */
  const handlePrint = (ticketNumber?: string) => {
    if (!meta) return
    openQuotationPrint(docFromTicket(
      ticket,
      totals.total_usd,
      { validityDays: parseInt(validityDays) || 7, notes, number: ticketNumber },
      meta,
    ))
  }

  const handleSaveAndPrint = async () => {
    setLoading(true)
    try {
      const saved = await onConfirm({ notes: notes || undefined })
      handlePrint(saved.ticket_number)
      toast('Cotización guardada', 'success')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al generar cotización', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar Cotización"
      size="sm"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="secondary"
            onClick={() => handlePrint()}
            disabled={!meta}
            leftIcon={<FileText size={15} />}
          >
            Solo imprimir
          </Button>
          <Button variant="primary" onClick={handleSaveAndPrint} loading={loading} disabled={!meta}>
            Guardar y imprimir
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {metaError && <p role="alert">No se pudieron cargar los datos del negocio. Cierra y vuelve a abrir la cotización.</p>}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cot-validity">
            Días de validez
          </label>
          <input
            id="cot-validity"
            type="number"
            className={styles.input}
            value={validityDays}
            onChange={(e) => setValidityDays(e.target.value)}
            min="1"
            max="365"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cot-notes">
            Observaciones <span className={styles.optional}>(opcional)</span>
          </label>
          <textarea
            id="cot-notes"
            className={styles.textarea}
            placeholder="Condiciones, aclaratorias, garantías..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Items</span><span>{ticket.items.length}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Total USD</span>
            <span className={styles.summaryUsd}>${totals.total_usd.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Total Bs.</span>
            <span className={styles.summaryBs}>
              Bs.&nbsp;{totals.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
