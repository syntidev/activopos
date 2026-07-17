'use client'

import { useEffect, useState, useMemo, type CSSProperties } from 'react'
import { ArrowLeft, Share2, Plus, Minus, Zap, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import type { CatalogProductVariant, PaymentMethod } from './CatalogoGrid'
import { useCart } from './CartContext'
import { CartHeaderButton } from './CartHeaderButton'
import { CartDrawer } from './CartDrawer'
import { fmtUsd, fmtBs, capitalize } from './catalogUtils'
import styles from './productoDetalle.module.css'

interface RelatedProduct {
  id:       number
  name:     string
  image:    string | null
  priceUsd: number
}

interface Props {
  productId:     number
  name:          string
  description:   string | null
  images:        string[]
  categoryName:  string | null
  categoryColor: string | null
  priceUsd:      number
  priceBs:       number | null
  variants:      CatalogProductVariant[]
  businessName:  string
  slug:          string
  rate:          number
  paymentMethods: PaymentMethod[]
  catalogUrl:    string
  relatedProducts: RelatedProduct[]
  businessLogo:  string | null
}

export function ProductoDetalle({
  productId, name, description, images, categoryName, categoryColor,
  priceUsd, priceBs, variants, businessName,
  catalogUrl, rate, slug, paymentMethods, relatedProducts, businessLogo,
}: Props) {
  const { addToCart, cartOpen, checkoutOpen, setCartOpen, setCheckoutOpen } = useCart()
  const [imageIndex,        setImageIndex]        = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [qty,               setQty]               = useState(1)
  const [variantError,      setVariantError]      = useState(false)

  // Scroll lock — el drawer/checkout del carrito puede abrirse desde esta página también
  useEffect(() => {
    const locked = cartOpen || checkoutOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, checkoutOpen])

  const selectedVariant  = variants.find(v => v.id === selectedVariantId) ?? null
  const effectivePrice   = priceUsd + (selectedVariant?.precio_extra ?? 0)
  const effectivePriceBs = priceBs !== null
    ? effectivePrice * rate
    : null

  const availableStock = selectedVariant
    ? selectedVariant.stock
    : Infinity

  const variantGroups = useMemo(() => {
    const map = new Map<string, CatalogProductVariant[]>()
    for (const v of variants) {
      if (!map.has(v.tipo)) map.set(v.tipo, [])
      map.get(v.tipo)!.push(v)
    }
    return Array.from(map.entries()).map(([tipo, options]) => ({ tipo, options }))
  }, [variants])

  // Agrega el producto actual (con la variante/cantidad elegida) al carrito.
  // Devuelve false si falta elegir variante — ambos CTAs (Agregar / Pedir
  // ahora) comparten esta misma validación y forma de item.
  const addCurrentToCart = (): boolean => {
    if (variants.length > 0 && !selectedVariant) { setVariantError(true); return false }
    addToCart({
      product_id:    productId,
      name,
      qty,
      price_usd:     effectivePrice,
      image_url:     images[0] ?? null,
      variant_id:    selectedVariant?.id,
      variant_label: selectedVariant ? `${capitalize(selectedVariant.tipo)}: ${selectedVariant.valor}` : undefined,
    })
    return true
  }

  return (
    <div className={styles.page}>

      {/* Mini header del negocio */}
      <header className={styles.productHeader}>
        <Link href={catalogUrl} className={styles.productHeaderBrand}>
          {businessLogo ? (
            <img src={businessLogo} alt={businessName} className={styles.productHeaderLogo} />
          ) : (
            <span className={styles.productHeaderInitial}>
              {businessName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className={styles.productHeaderName}>{businessName}</span>
        </Link>
        <CartHeaderButton />
      </header>

      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Navegación">
        <Link href={catalogUrl} className={styles.breadcrumbBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Volver al catálogo</span>
        </Link>
        {categoryName && (
          <>
            <span className={styles.breadcrumbSep} aria-hidden="true">›</span>
            <span className={styles.breadcrumbCat}>{categoryName}</span>
          </>
        )}
      </nav>

      {/* Layout 2 col desktop */}
      <div className={styles.layout}>

        {/* Galería */}
        <div className={styles.gallery}>
          <div className={styles.galleryMain}>
            {images[imageIndex] ? (
              <img
                src={images[imageIndex]}
                alt={name}
                className={styles.galleryMainImg}
              />
            ) : (
              <div className={styles.galleryPlaceholder} aria-hidden="true">
                <span className={styles.galleryInitial}>
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <button
              type="button"
              className={styles.galleryShare}
              onClick={() => navigator.share?.({ title: name, url: window.location.href }).catch(() => {})}
              aria-label={`Compartir ${name}`}
            >
              <Share2 size={18} aria-hidden="true" />
            </button>
          </div>
          {images.length > 1 && (
            <div className={styles.galleryThumbs} role="group" aria-label="Imágenes del producto">
              {images.map((src, idx) => (
                <button
                  key={src}
                  type="button"
                  className={`${styles.galleryThumb} ${idx === imageIndex ? styles.galleryThumbActive : ''}`}
                  onClick={() => setImageIndex(idx)}
                  aria-label={`Ver imagen ${idx + 1}`}
                  aria-pressed={idx === imageIndex}
                >
                  <img src={src} alt="" loading="lazy" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className={styles.info}>
          {categoryName && (
            <span
              className={styles.categoryBadge}
              style={categoryColor ? ({ color: categoryColor } as CSSProperties) : undefined}
            >
              {categoryName.toUpperCase()}
            </span>
          )}

          <h1 className={styles.productName}>{name}</h1>

          <div className={styles.priceBlock}>
            <span className={styles.priceUsd}>{fmtUsd(effectivePrice)}</span>
            {effectivePriceBs !== null && (
              <span className={styles.priceBs}>{fmtBs(effectivePriceBs)}</span>
            )}
          </div>

          {/* Variantes */}
          {variantGroups.length > 0 && (
            <div className={styles.variants}>
              {variantGroups.map(g => (
                <div key={g.tipo} className={styles.variantGroup}>
                  <span className={styles.variantLabel}>{capitalize(g.tipo)}</span>
                  <div className={styles.variantChips}>
                    {g.options.map(v => {
                      const soldOut = v.stock <= 0
                      const active  = selectedVariantId === v.id
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={`${styles.variantChip} ${active ? styles.variantChipActive : ''} ${soldOut ? styles.variantChipDisabled : ''}`}
                          onClick={() => { setSelectedVariantId(v.id); setVariantError(false) }}
                          disabled={soldOut}
                          aria-pressed={active}
                          aria-label={`${capitalize(g.tipo)}: ${v.valor}${soldOut ? ' — agotado' : ''}`}
                        >
                          {v.valor}
                          {soldOut && <span className={styles.soldOutLabel}>Agotado</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {variantError && (
                <p className={styles.variantError}>Selecciona una opción para continuar</p>
              )}
            </div>
          )}

          {/* Qty */}
          <div className={styles.qtyRow}>
            <span className={styles.qtyLabel}>Cantidad</span>
            <div className={styles.qtyControl}>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Reducir cantidad"
              >
                <Minus size={14} />
              </button>
              <span className={styles.qtyValue}>{qty}</span>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => setQty(q => Math.min(availableStock, q + 1))}
                disabled={qty >= availableStock}
                aria-label="Aumentar cantidad"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Info BCV */}
          <div className={styles.bcvNote}>
            <span>💱</span>
            <span>Recibimos bolívares a la tasa del dólar BCV</span>
          </div>

          {/* CTAs */}
          <div className={styles.ctas}>
            <button
              type="button"
              className={styles.btnAddCart}
              onClick={() => { if (addCurrentToCart()) setCartOpen(true) }}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              Agregar al carrito
            </button>
            <button
              type="button"
              className={styles.btnPedir}
              onClick={() => { if (addCurrentToCart()) setCheckoutOpen(true) }}
            >
              <Zap size={18} aria-hidden="true" />
              Pedir ahora · {fmtUsd(effectivePrice * qty)}
            </button>
            <button
              type="button"
              className={styles.btnShare}
              onClick={() => navigator.share?.({ title: name, url: window.location.href }).catch(() => {})}
              aria-label="Compartir"
            >
              <Share2 size={18} aria-hidden="true" />
            </button>
          </div>

          {description && (
            <div className={styles.productDescSection}>
              <h3 className={styles.productDescTitle}>Descripción</h3>
              <p className={styles.productDescText}>{description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Productos relacionados */}
      {relatedProducts.length > 0 && (
        <section className={styles.relatedSection}>
          <div className={styles.relatedHeader}>
            <h3 className={styles.relatedTitle}>Productos relacionados</h3>
            <Link href={catalogUrl} className={styles.relatedVerTodos}>
              Ver todos →
            </Link>
          </div>
          <div className={styles.relatedGrid}>
            {relatedProducts.map(rp => (
              <Link
                key={rp.id}
                href={`/catalogo/${slug}/p/${rp.id}`}
                className={styles.relatedCard}
              >
                <div className={styles.relatedImageWrap}>
                  {rp.image ? (
                    <img src={rp.image} alt={rp.name} className={styles.relatedImage} loading="lazy" />
                  ) : (
                    <div className={styles.relatedPlaceholder}>
                      {rp.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className={styles.relatedName}>{rp.name}</p>
                <p className={styles.relatedPrice}>{fmtUsd(rp.priceUsd)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CartDrawer slug={slug} rate={rate} paymentMethods={paymentMethods} />
    </div>
  )
}
