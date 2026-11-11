import Link from 'next/link'
import { useCatalogHref } from '@/components/catalog/CatalogLinks'
import type { CarteleraData } from './cartelera'
import { ProductCard } from './ProductCard'
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
  const href = useCatalogHref(slug)
  return (
    <section className={styles.carteleraSection} aria-label={data.collectionName} data-section="cartelera">
      <div className={styles.carteleraHeader}>
        <h2 className={styles.carteleraTitle}>{data.collectionName}</h2>
        <Link href={href(`/productos`)} className={styles.carteleraLink}>
          Ver todos →
        </Link>
      </div>
      <div className={styles.carteleraGrid}>
        {data.products.map((p, i) => (
          <div key={p.id} className={i === 0 ? styles.carteleraHero : styles.carteleraCell}>
            <ProductCard p={p} href={href(`/p/${p.id}`)} size={i === 0 ? 'hero' : 'card'} />
          </div>
        ))}
      </div>
    </section>
  )
}
