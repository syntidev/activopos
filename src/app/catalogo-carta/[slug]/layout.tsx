import type { ReactNode } from 'react'
import { CatalogLinksProvider } from '@/components/catalog/CatalogLinks'
import { isCleanFor } from '@/lib/catalog-links-server'
import { Cormorant_Garamond, Fraunces, Instrument_Sans } from 'next/font/google'
import { CartProvider } from '@/app/catalogo-premium/[slug]/CartContext'
import { ConfirmProvider } from '@/context/ConfirmContext'
import { getCartaBusiness } from '@/lib/carta/load'
import { readCartaSettings } from '@/lib/carta/settings'
import { cx } from './util'
import styles from './carta.module.css'

// Pares de fuentes de los presets (tokens --carta-font-*): Brasa = Fraunces + Instrument Sans; Noche = Cormorant Garamond + Instrument Sans.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-carta-fraunces', display: 'swap' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-carta-cormorant', display: 'swap' })
const sans = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-carta-sans', display: 'swap' })

interface CartaLayoutProps {
  children: ReactNode
  params:   { slug: string }
}

/** El carrito vive aquí para sobrevivir a la navegación carta ↔ ficha (mismo CartProvider que el catálogo premium). */
export default async function CartaLayout({ children, params }: CartaLayoutProps) {
  const business = await getCartaBusiness(params.slug)
  const settings = readCartaSettings(business?.settings)
  return (
    <div
      className={cx(styles.root, fraunces.variable, cormorant.variable, sans.variable)}
      data-testid="carta-root"
      data-carta-preset={settings.preset}
      data-carta-accent={settings.accent ?? undefined}
      data-carta-style={settings.style}
    >
      <ConfirmProvider>
        <CartProvider slug={params.slug}><CatalogLinksProvider kind="carta" clean={isCleanFor('carta', params.slug)}>{children}</CatalogLinksProvider></CartProvider>
      </ConfirmProvider>
    </div>
  )
}
