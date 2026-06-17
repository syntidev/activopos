import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563EB',
}

export const metadata: Metadata = {
  title: 'ActivoPOS — El POS para negocios que andan activos',
  description:
    'Sistema de punto de venta para PYMES venezolanas. BCV automático, multimoneda, reportería en tiempo real.',
  keywords: ['POS', 'punto de venta', 'Venezuela', 'BCV', 'bolívares'],
  authors: [{ name: 'SYNTIdev' }],
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ActivoPOS',
  },
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' }],
  },
}

const VALID_THEMES = new Set(['default', 'premium', 'calle', 'tropical', 'dark', 'light'])

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Best-effort: read theme from DB to set correct data-theme server-side
  // Falls back to 'default'; localStorage override fires via inline script
  let dbTheme = 'default'
  try {
    const session = await getSession()
    if (session?.businessId) {
      const biz = await prisma.business.findUnique({
        where:  { id: session.businessId },
        select: { theme: true },
      })
      if (biz?.theme && VALID_THEMES.has(biz.theme)) {
        dbTheme = biz.theme
      }
    }
  } catch {
    // Silent fallback — localStorage inline script handles client-side
  }

  return (
    <html lang="es" data-theme={dbTheme} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('activopos_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
