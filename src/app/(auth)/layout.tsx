import { Fraunces, DM_Sans } from 'next/font/google'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

// Mismo sistema tipográfico que la landing (src/app/(marketing)/layout.tsx): Fraunces
// display + DM Sans body. El login es "hijo de la landing", no un estilo aparte.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Usuario ya logueado que cae en /login (link viejo, back del navegador) -> nunca queda
  // varado en un formulario que no necesita; se lo manda directo a su dashboard según rol.
  const session = await getSession()
  if (session) redirect(session.role === 'super_admin' ? '/businesses' : '/escritorio')

  // data-theme="light": el login deja de ser navy sólido dominante -- los tokens
  // --mkt-*/--brand/--sand resuelven a sus valores claros (:root), navy queda de acento.
  return (
    <div className={`${fraunces.variable} ${dmSans.variable}`} data-theme="light">
      {children}
    </div>
  )
}
