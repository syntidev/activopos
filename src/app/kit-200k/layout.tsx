import type { ReactNode } from 'react'
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
  return <div className={dmSans.variable}>{children}</div>
}
