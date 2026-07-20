'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CajaRegisterInfo {
  openedAt:    string
  cashierName: string
}

interface CajaState {
  /** null = aún no se sabe (primer fetch en vuelo) — los consumidores no pintan nada todavía. */
  isOpen:   boolean | null
  register: CajaRegisterInfo | null
}

interface CajaContextValue extends CajaState {
  refreshCaja: () => Promise<void>
}

const CajaContext = createContext<CajaContextValue | null>(null)

const POLL_INTERVAL = 60_000

/**
 * Fuente única del estado de caja para el dashboard. Mismo patrón que
 * RateContext: antes Header y CajaToggle tenían cada uno su propio fetch con
 * deps [], así que abrir la caja desde el sidebar actualizaba el toggle pero
 * dejaba el pill del header en "Caja cerrada" hasta recargar la página.
 * Cualquier componente llama refreshCaja() y todos se actualizan a la vez.
 */
export function CajaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CajaState>({ isOpen: null, register: null })

  const refreshCaja = useCallback(async () => {
    try {
      const res = await fetch('/api/cash/status')
      if (!res.ok) return
      const j = await res.json() as { isOpen?: boolean; register?: CajaRegisterInfo }
      setState({
        isOpen:   !!j.isOpen,
        register: j.isOpen && j.register ? j.register : null,
      })
    } catch { /* mantiene el último valor conocido */ }
  }, [])

  useEffect(() => {
    void refreshCaja()
    const interval = setInterval(() => { void refreshCaja() }, POLL_INTERVAL)
    const handleFocus = () => { void refreshCaja() }
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshCaja])

  return (
    <CajaContext.Provider value={{ ...state, refreshCaja }}>
      {children}
    </CajaContext.Provider>
  )
}

export function useCaja(): CajaContextValue {
  const ctx = useContext(CajaContext)
  if (!ctx) throw new Error('useCaja() debe usarse dentro de <CajaProvider>')
  return ctx
}
