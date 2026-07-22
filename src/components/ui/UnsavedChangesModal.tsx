'use client'

import { Modal } from './Modal'
import { Button } from './Button'
import styles from './UnsavedChangesModal.module.css'

interface UnsavedChangesModalProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesModal({ open, message, onConfirm, onCancel }: UnsavedChangesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Tienes cambios sin guardar"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Seguir editando</Button>
          <Button variant="danger" onClick={onConfirm}>Descartar y salir</Button>
        </>
      }
    >
      <p className={styles.text}>{message}</p>
    </Modal>
  )
}
