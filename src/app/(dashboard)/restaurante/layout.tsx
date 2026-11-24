import type { ReactNode } from 'react'
import { gateRestaurante, rsFontClasses } from './scope'

/** Puerta del lado servidor de /restaurante: sin Business.restaurante_enabled → 404. */
export default async function RestauranteLayout({ children }: { children: ReactNode }) {
  await gateRestaurante()
  return <div data-restaurante="" className={rsFontClasses}>{children}</div>
}
