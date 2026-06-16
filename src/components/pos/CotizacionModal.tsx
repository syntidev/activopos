'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'
import { generarCotizacionPDF } from './TicketPDF'
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
  const [showUsd, setShowUsd] = useState(true)
  const [showBs, setShowBs] = useState(true)
  const [validityDays, setValidityDays] = useState('7')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePrint = () => {
    generarCotizacionPDF(ticket, totals, {
      showUsd,
      showBs,
      validityDays: parseInt(validityDays) || 7,
      notes,
    }, { businessName: 'Mi Negocio', cashierName: 'Cajero' })
  }

  const handleSaveAndPrint = async () => {
    setLoading(true)
    try {
      await onConfirm({ notes: notes || undefined })
      handlePrint()
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
            onClick={handlePrint}
            leftIcon={<FileText size={15} />}
          >
            Solo imprimir
          </Button>
          <Button variant="primary" onClick={handleSaveAndPrint} loading={loading}>
            Guardar y imprimir
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Monedas a mostrar</p>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={showUsd}
                onChange={(e) => setShowUsd(e.target.checked)}
                className={styles.checkbox}
              />
              Precios en USD
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={showBs}
                onChange={(e) => setShowBs(e.target.checked)}
                className={styles.checkbox}
              />
              Totales en Bs.
            </label>
          </div>
        </div>

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
