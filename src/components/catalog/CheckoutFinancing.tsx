'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PublicFinancing } from '@/lib/financing'

interface CheckoutFinancingValue {
  financing: PublicFinancing | null
  excludedIds: number[]
}

const CheckoutFinancingContext = createContext<CheckoutFinancingValue>({ financing: null, excludedIds: [] })

interface ProviderProps extends CheckoutFinancingValue {
  children: ReactNode
}

/** Lo monta el layout del catálogo (servidor) para que el CartDrawer sepa si ofrecer Cashea. */
export function CheckoutFinancingProvider({ financing, excludedIds, children }: ProviderProps) {
  return <CheckoutFinancingContext.Provider value={{ financing, excludedIds }}>{children}</CheckoutFinancingContext.Provider>
}

export const useCheckoutFinancing = (): CheckoutFinancingValue => useContext(CheckoutFinancingContext)
