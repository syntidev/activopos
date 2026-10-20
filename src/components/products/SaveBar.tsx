'use client'

import { Loader2 } from 'lucide-react'
import styles from './SaveBar.module.css'

interface SaveBarProps {
  formId: string
  isSaving: boolean
  onCancel: () => void
  saveLabel: string
  disabled?: boolean
}

/**
 * Barra de acciones pegada al borde inferior del área de scroll (sticky, no fixed):
 * ocupa su propio espacio en el flujo, así que nunca tapa el último campo del formulario.
 */
export function SaveBar({ formId, isSaving, onCancel, saveLabel, disabled = false }: SaveBarProps) {
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.cancel} onClick={onCancel} disabled={isSaving}>
        Cancelar
      </button>
      <button type="submit" form={formId} className={styles.save} disabled={isSaving || disabled}>
        {isSaving && <Loader2 size={16} className={styles.spin} aria-hidden="true" />}
        {isSaving ? 'Guardando...' : saveLabel}
      </button>
    </div>
  )
}
