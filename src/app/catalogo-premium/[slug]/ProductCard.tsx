import { type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { Flame, Sparkles, Tag, ThumbsUp, Star, Archive, Plus } from 'lucide-react'
import { ImgWithFallback } from './ImgWithFallback'
import { PrecioDual } from './PrecioDual'
import { categoryBadgeColor } from './catalogUtils'
import styles from './catalogo.module.css'

/** Campos mínimos que necesita la tarjeta: CatalogProduct los cumple; cartelera y landing aportan un subconjunto. */
export interface CardProduct {
  id:                 number
  name:               string
  image:              string | null
  images?:            string[]
  categoryName:       string | null
  priceUsd:           number
  priceBs:            number | null
  divisaUsd?:         number | null
  outOfStock?:        boolean
  isService?:         boolean
  stockQty?:          number | null
  stockHidden?:       boolean
  badge?:             string | null
  isFeatured?:        boolean
  catalogVisibility?: 'visible' | 'on_request' | 'hidden'
  availability?:      'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  /** Con tallas el "+" abre la ficha para elegirla; sin tallas agrega al carrito. */
  hasVariants?:       boolean
}

interface ProductCardProps {
  p:              CardProduct
  href:           string
  index?:         number
  accentColor?:   string | null
  categoryColor?: string | null
  size?:          'card' | 'hero'
}

function getBadgeClass(badge: string | null | undefined): string {
  switch (badge) {
    case 'popular':     return styles.badgePopular
    case 'nuevo':       return styles.badgeNuevo
    case 'promo':       return styles.badgePromo
    case 'recomendado': return styles.badgeRecomendado
    default:            return ''
  }
}

const BADGE_LABEL: Record<string, string> = {
  popular:     'Popular',
  nuevo:       'Nuevo',
  promo:       'Promo',
  recomendado: 'Recomendado',
}

const BADGE_ICON: Record<string, ReactNode> = {
  popular:     <Flame size={10} aria-hidden="true" />,
  nuevo:       <Sparkles size={10} aria-hidden="true" />,
  promo:       <Tag size={10} aria-hidden="true" />,
  recomendado: <ThumbsUp size={10} aria-hidden="true" />,
}

/** Tarjeta única del catálogo premium (patrón de "Productos Destacados"): se usa en todas las secciones. */
export function ProductCard({ p: raw, href, index = 0, accentColor, categoryColor, size = 'card' }: ProductCardProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const p = {
    images: [] as string[], outOfStock: false, isService: false, stockQty: null, stockHidden: false, badge: null,
    isFeatured: false, hasVariants: false, catalogVisibility: 'visible' as const, availability: 'in_stock' as const, ...raw,
  }
  const i = index
  const { hasVariants } = p
  const isOut = p.outOfStock || p.availability === 'out_of_stock'
  const cardStyle: CSSProperties = { '--card-index': Math.min(i, 12) } as CSSProperties
  if (accentColor) (cardStyle as Record<string, string>)['--accent-cat'] = accentColor
  return (
    <article
              className={`${styles.productCard} ${size === 'hero' ? styles.productCardHero : ''} ${isOut ? styles.productCardOutOfStock : ''}`}
      style={cardStyle}
      onClick={() => router.push(href)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(href) }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle: ${p.name}`}
    >
      {/* Hija directa de la card: con el inset de la imagen, dentro del wrap
          la barra dejaría de ir al ancho completo del borde superior. */}
      <span className={styles.productCardAccent} aria-hidden="true" />
      <div className={styles.productImageWrap}>
        {p.image ? (
          <ImgWithFallback
            src={p.image}
            className={styles.productImage}
            loading="lazy"
            imgRef={img => { if (img?.complete) img.classList.add(styles.productImageLoaded) }}
            onLoad={img => img.classList.add(styles.productImageLoaded)}
            fallback={
              <div className={`${styles.productImagePlaceholder} ${styles.gradDefault}`} aria-hidden="true">
                <span className={styles.productInitial}>{p.name.charAt(0).toUpperCase()}</span>
              </div>
            }
          />
        ) : (
          <div className={`${styles.productImagePlaceholder} ${styles.gradDefault}`} aria-hidden="true">
            <span className={styles.productInitial}>{p.name.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Hover con 2da imagen — CSS-only (sin JS/estado), mismo criterio
            de crossfade que el resto del catálogo. No hay ningún producto
            de OnBike con 2+ imágenes hoy (verificado en DB): el mecanismo
            queda listo, invisible hasta que se suba contenido real. */}
        {p.images.length >= 2 && (
          <img
            src={p.images[1]}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={styles.productImageHover}
          />
        )}

        {p.availability === 'discontinued' ? (
          <div className={styles.badgeDiscontinued} aria-label="Descontinuado">
            <span><Archive size={10} aria-hidden="true" />&nbsp;Descontinuado</span>
          </div>
        ) : p.catalogVisibility === 'on_request' ? (
          <div className={styles.badgeOnRequest} aria-label="Bajo pedido">Consultar</div>
        ) : isOut ? (
          <span className={styles.badgeSinStock}>Sin stock</span>
        ) : p.availability === 'low_stock' ? (
          <span className={styles.badgeLowStock}>Pocas unidades</span>
        ) : p.isService ? (
          <span className={styles.badgeDisponible}>Disponible</span>
        ) : p.stockHidden ? (
          <span className={styles.badgeDisponible}>Disponible</span>
        ) : p.stockQty !== null && p.stockQty > 0 ? (
          <span className={styles.badgeStock}>
            {p.stockQty <= 5 ? `Últimas ${p.stockQty}` : `${p.stockQty} uds.`}
          </span>
        ) : null}

        {p.isFeatured && p.catalogVisibility !== 'on_request' && !isOut && (
          <span className={styles.badgeEspecial}>
            <Star size={9} fill="currentColor" aria-hidden="true" />
            Especial
          </span>
        )}

        {p.catalogVisibility !== 'on_request' &&
          !p.outOfStock &&
          !p.isService &&
          p.badge && p.badge !== 'none' &&
          getBadgeClass(p.badge) && (
          <span className={`${styles.productBadge} ${getBadgeClass(p.badge)}`}>
            {BADGE_ICON[p.badge]}
            {BADGE_LABEL[p.badge]}
          </span>
        )}

        {/* Badge de categoría con color propio -- complementa "Especial" (que marca
            isFeatured, otro dato): categoría siempre se distingue por color, "Especial"
            solo aparece si el producto está marcado como tal. */}
        {p.categoryName && p.catalogVisibility !== 'on_request' && (
          <span
            className={styles.categoryImgBadge}
            style={{ '--badge-color': categoryBadgeColor(p.categoryName, categoryColor) } as CSSProperties}
          >
            {p.categoryName}
          </span>
        )}
      </div>

      <div className={styles.productInfo}>
        {p.categoryName && <p className={styles.productCategory}>{p.categoryName}</p>}
        <h2 className={styles.productName}>{p.name}</h2>

        {/* Precio + CTA circular, alineados al pie de la info */}
        <div className={styles.priceRow}>
        <PrecioDual
          size="card"
          priceUsd={p.priceUsd}
          priceBs={p.priceBs}
          divisaUsd={p.divisaUsd}
          catalogVisibility={p.catalogVisibility}
          availability={p.availability}
        />

        {/* CTA circular — mismo handler que el botón full-width anterior:
            con variantes abre el detalle, sin variantes agrega al carrito. */}
        {p.catalogVisibility !== 'on_request' &&
          p.availability !== 'discontinued' &&
          !isOut &&
          p.availability !== 'out_of_stock' &&
          p.priceUsd > 0 && (
          <button
            type="button"
            className={styles.addBtnCircle}
            onClick={e => {
              e.stopPropagation()
              hasVariants
                ? router.push(href)
                : addToCart({ product_id: p.id, name: p.name, qty: 1, price_usd: p.priceUsd, image_url: p.image })
            }}
            aria-label={
              hasVariants
                ? `Ver opciones de ${p.name}`
                : `Agregar ${p.name} al carrito`
            }
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
        </div>
      </div>
    </article>
  )
}
