import Link from 'next/link'
import type { CarteleraData } from './cartelera'
import { ProductCard } from './ProductCard'
import { AdaptiveGrid } from '@/components/ui/AdaptiveGrid'
import styles from './catalogo.module.css'

interface CarteleraGridProps {
  data: CarteleraData
  slug: string
}

/**
 * Cartelera de campaña — grid premium del mockup (artboard "Destacados — grid
 * premium"): 1 tile grande (2 columnas × 2 filas) + 4 tiles normales del mismo
 * tamaño entre sí. Data-driven: el título y los 5 productos vienen de la
 * Collection marcada como cartelera activa (ver cartelera.ts).
 */
export function CarteleraGrid({ data, slug }: CarteleraGridProps) {
  return (
    <section className={styles.carteleraSection} aria-label={data.collectionName} data-section="cartelera">
      <div className={styles.carteleraHeader}>
        <h2 className={styles.carteleraTitle}>{data.collectionName}</h2>
        <Link href={`/catalogo-premium/${slug}/productos`} className={styles.carteleraLink}>
          Ver todos →
        </Link>
      </div>
      <AdaptiveGrid max={{ mobile: 2, tablet: 3, desktop: 5 }}>
        {data.products.map(p => (
          <ProductCard key={p.id} p={p} href={`/catalogo-premium/${slug}/p/${p.id}`} />
        ))}
      </AdaptiveGrid>
    </section>
  )
}
