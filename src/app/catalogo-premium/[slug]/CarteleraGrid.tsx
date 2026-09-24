import Link from 'next/link'
import { ImageOff } from 'lucide-react'
import type { CarteleraData, CarteleraProduct } from './cartelera'
import { ImgWithFallback } from './ImgWithFallback'
import styles from './catalogo.module.css'
import { fmtBs } from './catalogUtils'

interface CarteleraGridProps {
  data: CarteleraData
  slug: string
}

const PRICE_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

function CarteleraTile({ product, slug, isBig }: { product: CarteleraProduct; slug: string; isBig: boolean }) {
  return (
    <Link
      href={`/catalogo-premium/${slug}/p/${product.id}`}
      className={`${styles.carteleraTile} ${isBig ? styles.carteleraTileBig : ''}`}
    >
      <ImgWithFallback
        src={product.image ?? ''}
        className={styles.carteleraImg}
        loading="lazy"
        fallback={
          <div className={styles.carteleraImgFallback} aria-hidden="true">
            <ImageOff size={28} strokeWidth={1.5} />
          </div>
        }
      />
      <div className={styles.carteleraScrim} aria-hidden="true" />
      {isBig && product.badge ? <div className={styles.carteleraBadge}>{product.badge}</div> : null}
      <div className={styles.carteleraLabel}>
        {product.categoryName ? <div className={styles.carteleraCat}>{product.categoryName}</div> : null}
        <div className={styles.carteleraName}>{product.name}</div>
        {product.priceUsd > 0 ? (
          <div className={styles.carteleraPrice}>
            ${product.priceUsd.toLocaleString('en-US', PRICE_FORMAT)}
            {product.priceBs !== null ? (
              <span className={styles.carteleraPriceBs}> · {fmtBs(product.priceBs)}</span>
            ) : null}
          </div>
        ) : (
          <div className={styles.carteleraPrice}>Consultar precio</div>
        )}
      </div>
    </Link>
  )
}

/**
 * Cartelera de campaña — grid premium del mockup (artboard "Destacados — grid
 * premium"): 1 tile grande (2 columnas × 2 filas) + 4 tiles normales del mismo
 * tamaño entre sí. Data-driven: el título y los 5 productos vienen de la
 * Collection marcada como cartelera activa (ver cartelera.ts).
 */
export function CarteleraGrid({ data, slug }: CarteleraGridProps) {
  const [big, ...rest] = data.products
  return (
    <section className={styles.carteleraSection} aria-label={data.collectionName} data-section="cartelera">
      <div className={styles.carteleraHeader}>
        <h2 className={styles.carteleraTitle}>{data.collectionName}</h2>
        <Link href={`/catalogo-premium/${slug}/productos`} className={styles.carteleraLink}>
          Ver todos →
        </Link>
      </div>
      <div className={styles.carteleraGrid}>
        <CarteleraTile product={big} slug={slug} isBig />
        {rest.map(p => (
          <CarteleraTile key={p.id} product={p} slug={slug} isBig={false} />
        ))}
      </div>
    </section>
  )
}
