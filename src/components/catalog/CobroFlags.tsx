'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { PAY_DEFAULT, type CartPayOptions } from '@/lib/cart-pay'

interface CobroFlags {
  /** Configuración › Cobro y precios: false = ningún logo, chip, línea ni opción Cashea. Por defecto, encendido. */
  casheaActive: boolean
  /** Formas de pago del carrito ya filtradas por lo que decidió el negocio (Divisa, Bs real o Bs genérico). */
  pay: CartPayOptions
}

const CobroFlagsContext = createContext<CobroFlags>({ casheaActive: true, pay: PAY_DEFAULT })

/** Lo monta el layout del catálogo (servidor) con lo que decidió el negocio. */
export function CobroFlagsProvider({ casheaActive, pay, children }: CobroFlags & { children: ReactNode }) {
  return <CobroFlagsContext.Provider value={{ casheaActive, pay }}>{children}</CobroFlagsContext.Provider>
}

export const useCobroFlags = (): CobroFlags => useContext(CobroFlagsContext)
