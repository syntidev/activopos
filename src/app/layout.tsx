import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '800'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#EF8E01',
}

export const metadata: Metadata = {
  title: {
    default: 'ActivoPOS',
    template: '%s | ActivoPOS',
  },
  description: 'Tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa.',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ActivoPOS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/activopos-logo-icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  other: {
    'meta-author': 'ActivoPOS — synti.dev',
    'geo.region':    'VE',
    'geo.placename': 'Venezuela',
  },
  // NO poner 'robots' dentro de other: — other es passthrough crudo, emite un
  // <meta name="robots"> extra que NO participa del merge de Next y sobrevive a
  // los override de cada page. Rompia el noindex de /privacidad y /terminos.
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:  true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet':       -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    locale: 'es_VE',
    alternateLocale: ['es_ES'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable}`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          storageKey="activopos-theme"
          themes={['light', 'dark']}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})});var swRefreshed=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(swRefreshed)return;swRefreshed=true;window.location.reload()})}`
          }}
        />
      </body>
    </html>
  )
}
