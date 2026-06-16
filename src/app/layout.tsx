import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ActivoPOS — El POS para negocios que andan activos',
  description: 'Sistema de punto de venta para PYMES venezolanas. BCV automático, multimoneda, reportería en tiempo real.',
  keywords: ['POS', 'punto de venta', 'Venezuela', 'BCV', 'bolívares'],
  authors: [{ name: 'SYNTIdev' }],
  robots: 'noindex, nofollow', // cambiar a index,follow en producción
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  )
}
