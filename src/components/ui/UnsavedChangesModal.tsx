'use client'

import { ConfirmDialog } from './ConfirmDialog'

interface UnsavedChangesModalProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

/** "Cambios sin guardar": caso particular de ConfirmDialog (un solo camino de confirmación). */
export function UnsavedChangesModal({ open, message, onConfirm, onCancel }: UnsavedChangesModalProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Tienes cambios sin guardar"
      message={message}
      cancelLabel="Seguir editando"
      confirmLabel="Descartar y salir"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
