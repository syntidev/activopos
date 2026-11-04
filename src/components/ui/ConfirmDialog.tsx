'use client'

import { useRef, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Qué se pierde (ej. "Ticket 2 · 3 productos · $45,00"). */
  message: ReactNode
  /** Verbo concreto de la acción roja (ej. "Cerrar y borrar ticket"). */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  /** Cancelar, Esc y clic fuera. */
  onCancel: () => void
}

/**
 * Único camino para confirmar acciones que borran datos. El foco abre en Cancelar:
 * un Enter distraído nunca destruye nada.
 */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className={styles.text}>{message}</div>
    </Modal>
  )
}
