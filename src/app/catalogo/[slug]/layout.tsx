import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { identityMetadata, identityViewport } from '@/lib/web-identity'
import { Ga4 } from '@/components/catalog/CatalogSeo'
import { CartProvider } from './CartContext'
import { CheckoutFinancingProvider } from '@/components/catalog/CheckoutFinancing'
import { CobroFlagsProvider } from '@/components/catalog/CobroFlags'
import { loadCheckoutFinancing, loadCobroFlags } from '@/lib/catalog-checkout-financing'

interface LayoutProps {
  children: ReactNode
  params:   { slug: string }
}

// Identidad web del negocio (favicon/manifest/theme-color); sin favicon propio quedan los de ActivoPOS.
export const generateMetadata = ({ params }: LayoutProps): Promise<Metadata> => identityMetadata(params.slug)
export const generateViewport = ({ params }: LayoutProps): Promise<Viewport> => identityViewport(params.slug)

// Compartido por page.tsx (home), productos/page.tsx y p/[id]/page.tsx —
// el CartProvider vive aquí para que el carrito no se resetee al navegar
// entre esas 3 rutas (cada una desmonta el componente de la anterior).
export default async function CatalogoSlugLayout({ children, params }: LayoutProps) {
  // Cashea en el checkout: solo si el negocio tiene financiamiento activo; los excluidos se cruzan con el carrito.
  const { financing, excludedIds } = await loadCheckoutFinancing(params.slug)
  // Formas de pago del carrito ya filtradas por "Cobro y precios" (Divisa, Bs real o Bs genérico).
  const { casheaActive, pay } = await loadCobroFlags(params.slug)
  return (
    <CheckoutFinancingProvider financing={financing} excludedIds={excludedIds}>
      <CobroFlagsProvider casheaActive={casheaActive} pay={pay}>
        <CartProvider slug={params.slug}><Ga4 slug={params.slug} />{children}</CartProvider>
      </CobroFlagsProvider>
    </CheckoutFinancingProvider>
  )
}
