'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

interface RateState {
  rate: number | null
  source: string | null
  manualActive: boolean
  bcvRate: number | null
}

interface RateContextValue extends RateState {
  refreshRate: () => Promise<void>
}

const RateContext = createContext<RateContextValue | null>(null)

const POLL_INTERVAL = 60_000

/**
 * Fuente única de la tasa activa para todo el dashboard. Reemplaza las 3 copias
 * independientes (Header, DashboardShell, TabGeneral) que se sincronizaban a
 * mano vía CustomEvent — cualquier componente llama refreshRate() y todos los
 * consumidores se actualizan al mismo tiempo, sin depender del próximo poll.
 */
export function RateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RateState>({
    rate: null, source: null, manualActive: false, bcvRate: null,
  })

  const refreshRate = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/bcv')
      if (!res.ok) return
      const j = await res.json() as {
        ok?: boolean; rate?: number; source?: string; manual_active?: boolean; bcv_rate?: number
      }
      if (j.ok && typeof j.rate === 'number') {
        setState({
          rate:         j.rate,
          source:       j.source ?? 'bcv',
          manualActive: !!j.manual_active,
          bcvRate:      typeof j.bcv_rate === 'number' ? j.bcv_rate : j.rate,
        })
      }
    } catch { /* mantiene el último valor conocido */ }
  }, [])

  useEffect(() => {
    void refreshRate()
    const interval = setInterval(() => { void refreshRate() }, POLL_INTERVAL)
    const handleFocus = () => { void refreshRate() }
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshRate])

  return (
    <RateContext.Provider value={{ ...state, refreshRate }}>
      {children}
    </RateContext.Provider>
  )
}

export function useRate(): RateContextValue {
  const ctx = useContext(RateContext)
  if (!ctx) throw new Error('useRate() debe usarse dentro de <RateProvider>')
  return ctx
}
