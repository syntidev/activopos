import type { ReactNode } from 'react'
import { CartProvider } from './CartContext'
import { CheckoutFinancingProvider } from '@/components/catalog/CheckoutFinancing'
import { loadCheckoutFinancing } from '@/lib/catalog-checkout-financing'

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
  return (
    <CheckoutFinancingProvider financing={financing} excludedIds={excludedIds}>
      <CartProvider slug={params.slug}>{children}</CartProvider>
    </CheckoutFinancingProvider>
  )
}
