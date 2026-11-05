'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface CobroFlags {
  /** Configuración › Cobro y precios: false = ningún logo, chip, línea ni opción Cashea. Por defecto, encendido. */
  casheaActive: boolean
}

const CobroFlagsContext = createContext<CobroFlags>({ casheaActive: true })

/** Lo monta el layout del catálogo (servidor) con lo que decidió el negocio. */
export function CobroFlagsProvider({ casheaActive, children }: CobroFlags & { children: ReactNode }) {
  return <CobroFlagsContext.Provider value={{ casheaActive }}>{children}</CobroFlagsContext.Provider>
}

export const useCobroFlags = (): CobroFlags => useContext(CobroFlagsContext)
