import type { ReactNode } from 'react'
import { CatalogLinksProvider } from '@/components/catalog/CatalogLinks'
import { currentCustomDomain } from '@/lib/catalog-links-server'
import { DM_Sans } from 'next/font/google'

// Fraunces ya se carga globalmente en app/layout.tsx (--font-fraunces, 700/800) —
// esta página solo necesita sumar DM Sans (cuerpo, per mockup aprobado), sin
// pisar --font-sans (Inter) que usa el resto del sistema.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight:  ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export default function Kit200KLayout({ children }: { children: ReactNode }) {
  // En el dominio propio premium, los enlaces del catálogo salen limpios (/, /tienda…); el kit es de OnBike (slug fijo).
  const clean = currentCustomDomain()?.kind === 'premium'
  return <div className={dmSans.variable}><CatalogLinksProvider kind="premium" clean={clean}>{children}</CatalogLinksProvider></div>
}
