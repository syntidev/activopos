'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { UnsavedChangesModal } from '@/components/ui/UnsavedChangesModal'

const DEFAULT_MESSAGE = 'Si sales ahora, perderás los cambios sin guardar.'

interface UnsavedChangesContextValue {
  setDirty: (dirty: boolean, message?: string) => void
  /**
   * Sidebar la llama en el onClick de cada Link, con la navegación real como
   * callback. Devuelve true si interceptó (el caller debe preventDefault());
   * false si no hay cambios sin guardar y la navegación nativa debe seguir.
   */
  guardNavigation: (proceed: () => void) => boolean
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null)

/**
 * Fuente única de "hay cambios sin guardar" para todo el dashboard. Sidebar y
 * la página con el formulario son HERMANOS bajo DashboardShell (Sidebar no es
 * ancestro de la página) — sin un contexto compartido, Sidebar no tiene forma
 * de saber que hay algo que perder antes de navegar.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty]     = useState(false)
  const [message, setMessage]     = useState(DEFAULT_MESSAGE)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingRef = useRef<(() => void) | null>(null)
  const isDirtyRef  = useRef(false)
  isDirtyRef.current = isDirty

  const setDirty = useCallback((dirty: boolean, msg?: string) => {
    setIsDirty(dirty)
    if (msg) setMessage(msg)
  }, [])

  const guardNavigation = useCallback((proceed: () => void): boolean => {
    if (!isDirtyRef.current) return false
    pendingRef.current = proceed
    setConfirmOpen(true)
    return true
  }, [])

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false)
    setIsDirty(false)
    const proceed = pendingRef.current
    pendingRef.current = null
    proceed?.()
  }, [])

  const handleCancel = useCallback(() => {
    setConfirmOpen(false)
    pendingRef.current = null
  }, [])

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, guardNavigation }}>
      {children}
      <UnsavedChangesModal
        open={confirmOpen}
        message={message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges(): UnsavedChangesContextValue {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) throw new Error('useUnsavedChanges() debe usarse dentro de <UnsavedChangesProvider>')
  return ctx
}
