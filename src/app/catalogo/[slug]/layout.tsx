import type { ReactNode } from 'react'
import { CartProvider } from './CartContext'

interface LayoutProps {
  children: ReactNode
  params:   { slug: string }
}

// Compartido por page.tsx (home), productos/page.tsx y p/[id]/page.tsx —
// el CartProvider vive aquí para que el carrito no se resetee al navegar
// entre esas 3 rutas (cada una desmonta el componente de la anterior).
export default function CatalogoSlugLayout({ children, params }: LayoutProps) {
  return <CartProvider slug={params.slug}>{children}</CartProvider>
}
