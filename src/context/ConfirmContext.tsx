'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Manejador activo (lo registra ConfirmProvider) para `confirmAction`, que se usa fuera de hooks. */
let activeConfirm: ConfirmFn | null = null

/**
 * `if (!(await confirmAction({ title, message, confirmLabel }))) return` — reemplaza window.confirm.
 * Sin ConfirmProvider montado devuelve false: ante la duda, NO se borra.
 */
export const confirmAction: ConfirmFn = (options) => (activeConfirm ? activeConfirm(options) : Promise.resolve(false))

/** Una sola vista de confirmación, accesible, con el foco en Cancelar. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false)
    setOptions(opts)
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  useEffect(() => {
    activeConfirm = confirm
    return () => { if (activeConfirm === confirm) activeConfirm = null }
  }, [confirm])

  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmDialog
          open
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}
