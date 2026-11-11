import Link from 'next/link'
import { useCatalogHref } from '@/components/catalog/CatalogLinks'
import type { CatalogProduct } from './CatalogoGrid'
import { ProductCard } from './ProductCard'
import { AdaptiveGrid } from '@/components/ui/AdaptiveGrid'
import styles from './catalogo.module.css'

interface NovedadesSectionProps {
  products: CatalogProduct[]
  slug:     string
}

/**
 * Sección "Novedades" — grid mixto de producto del mockup (artboard Desktop,
 * sección 6). TODAS las cards miden lo mismo (imagen 1/1, sin excepciones).
 * 4 columnas en desktop, 2 en mobile, con los valores exactos del mockup.
 * Precio en USD y Bs juntos (regla monetaria sellada del proyecto).
 */
export function NovedadesSection({ products, slug }: NovedadesSectionProps) {
  const href = useCatalogHref(slug)
  return (
    <section className={styles.novedadesSection} aria-label="Novedades" data-section="novedades">
      <div className={styles.novedadesHeader}>
        <h2 className={styles.novedadesTitle}>Novedades</h2>
        <Link href={href(`/productos`)} className={styles.novedadesLink}>
          Ver todos →
        </Link>
      </div>

      <AdaptiveGrid>
        {products.map(p => (
          <ProductCard key={p.id} p={{ ...p, hasVariants: p.variants.length > 0 }} href={href(`/p/${p.id}`)} />
        ))}
      </AdaptiveGrid>
    </section>
  )
}
