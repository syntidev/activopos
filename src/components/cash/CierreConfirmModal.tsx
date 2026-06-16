'use client'

import { CheckCircle, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import styles from './CierreConfirmModal.module.css'

interface TurnoStats {
  salesCount: number
  totalVentasBs: number
  totalVentasUsd: number
  efectivoEsperado: number
}

interface CierreConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  closingAmounts: { usd: number; bs: number }
  turnoStats: TurnoStats
  loading: boolean
}

function fmtBs(n: number) {
  return `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function CierreConfirmModal({
  open,
  onClose,
  onConfirm,
  closingAmounts,
  turnoStats,
  loading,
}: CierreConfirmModalProps) {
  const diferencia = closingAmounts.bs - turnoStats.efectivoEsperado
  const cuadra = Math.abs(diferencia) <= 1

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar Cierre de Caja"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Confirmar Cierre
          </Button>
        </>
      }
    >
      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Ventas del turno</span>
          <span className={styles.summaryValue}>
            {turnoStats.salesCount} tickets · {fmtUsd(turnoStats.totalVentasUsd)}
          </span>
        </div>

        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Efectivo esperado</span>
          <span className={styles.summaryValue}>{fmtBs(turnoStats.efectivoEsperado)}</span>
        </div>

        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Efectivo contado</span>
          <span className={styles.summaryValue}>{fmtBs(closingAmounts.bs)}</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.diferenciaRow}>
          <span className={styles.diferenciaLabel}>Diferencia</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className={cuadra || diferencia > 0 ? styles.diferenciaValOk : styles.diferenciaValErr}>
              {diferencia >= 0 ? '+' : ''}{fmtBs(diferencia)}
            </span>
            <span className={cuadra || diferencia > 0 ? `${styles.statusBadge} ${styles.statusBadgeOk}` : `${styles.statusBadge} ${styles.statusBadgeErr}`}>
              {cuadra || diferencia > 0 ? (
                <><CheckCircle size={11} aria-hidden="true" /> {cuadra ? 'Cuadra' : 'Sobrante'}</>
              ) : (
                <><AlertTriangle size={11} aria-hidden="true" /> Faltante</>
              )}
            </span>
          </div>
        </div>
      </div>

      <p className={styles.question}>
        ¿Confirmar cierre del turno? Esta acción no se puede deshacer.
      </p>
    </Modal>
  )
}
