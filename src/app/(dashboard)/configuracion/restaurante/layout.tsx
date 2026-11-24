import type { ReactNode } from 'react'
import { gateRestaurante, rsFontClasses } from '../../restaurante/scope'

/** Misma puerta que /restaurante. El middleware ya limita /configuracion a admin. */
export default async function ConfigRestauranteLayout({ children }: { children: ReactNode }) {
  await gateRestaurante()
  return <div data-restaurante="" className={rsFontClasses}>{children}</div>
}
