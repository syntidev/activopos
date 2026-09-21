import Link from 'next/link'
import { ImageOff } from 'lucide-react'
import type { CatalogProduct } from './CatalogoGrid'
import { ImgWithFallback } from './ImgWithFallback'
import styles from './catalogo.module.css'

interface NovedadesSectionProps {
  products: CatalogProduct[]
  slug:     string
}

const PRICE_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

/**
 * Sección "Novedades" — grid mixto de producto del mockup (artboard Desktop,
 * sección 6). TODAS las cards miden lo mismo (imagen 1/1, sin excepciones).
 * 4 columnas en desktop, 2 en mobile, con los valores exactos del mockup.
 * Precio en USD y Bs juntos (regla monetaria sellada del proyecto).
 */
export function NovedadesSection({ products, slug }: NovedadesSectionProps) {
  return (
    <section className={styles.novedadesSection} aria-label="Novedades" data-section="novedades">
      <div className={styles.novedadesHeader}>
        <h2 className={styles.novedadesTitle}>Novedades</h2>
        <Link href={`/catalogo-premium/${slug}/productos`} className={styles.novedadesLink}>
          Ver todos →
        </Link>
      </div>

      <div className={styles.novedadesGrid}>
        {products.map(p => (
          <Link
            key={p.id}
            href={`/catalogo-premium/${slug}/p/${p.id}`}
            className={styles.novedadesCard}
          >
            <div className={styles.novedadesMedia}>
              <ImgWithFallback
                src={p.image ?? ''}
                className={styles.novedadesImg}
                loading="lazy"
                fallback={<ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />}
              />
            </div>
            {p.categoryName ? <div className={styles.novedadesCategory}>{p.categoryName}</div> : null}
            <div className={styles.novedadesName}>{p.name}</div>
            {p.priceUsd > 0 ? (
              <>
                <div className={styles.novedadesPrice}>${p.priceUsd.toLocaleString('en-US', PRICE_FORMAT)}</div>
                {p.priceBs !== null ? (
                  <div className={styles.novedadesPriceBs}>Bs. {p.priceBs.toLocaleString('en-US', PRICE_FORMAT)}</div>
                ) : null}
              </>
            ) : (
              <div className={styles.novedadesPrice}>Consultar precio</div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
