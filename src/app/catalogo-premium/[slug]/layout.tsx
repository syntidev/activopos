import type { ReactNode } from 'react'
import { CartProvider } from './CartContext'
import { CheckoutFinancingProvider } from '@/components/catalog/CheckoutFinancing'
import { loadCheckoutFinancing, loadCobroFlags } from '@/lib/catalog-checkout-financing'
import { CobroFlagsProvider } from '@/components/catalog/CobroFlags'
import PulsoTracker from '@/components/pulso/PulsoTracker'

interface LayoutProps {
  children: ReactNode
  params:   { slug: string }
}

// Compartido por page.tsx (home), productos/page.tsx y p/[id]/page.tsx —
// el CartProvider vive aquí para que el carrito no se resetee al navegar
// entre esas 3 rutas (cada una desmonta el componente de la anterior).
export default async function CatalogoSlugLayout({ children, params }: LayoutProps) {
  // Cashea en el checkout: solo si el negocio tiene financiamiento activo; los excluidos se cruzan con el carrito.
  const { financing, excludedIds } = await loadCheckoutFinancing(params.slug)
  const { casheaActive } = await loadCobroFlags(params.slug)
  return (
    <CheckoutFinancingProvider financing={financing} excludedIds={excludedIds}>
      <CobroFlagsProvider casheaActive={casheaActive}>
        <CartProvider slug={params.slug}>
          <PulsoTracker slug={params.slug} />
          {children}
        </CartProvider>
      </CobroFlagsProvider>
    </CheckoutFinancingProvider>
  )
}
