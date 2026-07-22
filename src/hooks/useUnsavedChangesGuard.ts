'use client'

import { useEffect } from 'react'
import { useUnsavedChanges } from '@/context/UnsavedChangesContext'

const DEFAULT_MESSAGE = 'Si sales ahora, perderás los cambios sin guardar.'

/**
 * Un solo call site cubre las dos formas de perder datos:
 * 1. beforeunload — cerrar pestaña/navegador/recargar (el navegador nativo).
 * 2. Navegación interna — registra isDirty en UnsavedChangesContext, que
 *    Sidebar consulta en el onClick de cada Link antes de navegar.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string = DEFAULT_MESSAGE): void {
  const { setDirty } = useUnsavedChanges()

  useEffect(() => {
    setDirty(isDirty, message)
    return () => setDirty(false)
  }, [isDirty, message, setDirty])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
