'use client'

import { useState, useMemo, type CSSProperties } from 'react'
import { ArrowLeft, Share2, Plus, Minus, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import type { CatalogProductVariant } from './CatalogoGrid'
import styles from './productoDetalle.module.css'

interface Props {
  name:          string
  description:   string | null
  images:        string[]
  categoryName:  string | null
  categoryColor: string | null
  priceUsd:      number
  priceBs:       number | null
  variants:      CatalogProductVariant[]
  businessPhone: string
  businessName:  string
  slug:          string
  rate:          number
  catalogUrl:    string
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtBs(n: number) {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ProductoDetalle({
  name, description, images, categoryName, categoryColor,
  priceUsd, priceBs, variants, businessPhone,
  catalogUrl, rate,
}: Props) {
  const [imageIndex,        setImageIndex]        = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [qty,               setQty]               = useState(1)
  const [variantError,      setVariantError]      = useState(false)

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

  const waUrl = businessPhone
    ? `https://wa.me/${businessPhone}?text=${encodeURIComponent(
        `Hola, quiero pedir: ${name}${selectedVariant ? ` (${selectedVariant.valor})` : ''} x${qty} — ${fmtUsd(effectivePrice * qty)}`
      )}`
    : '#'

  return (
    <div className={styles.page}>

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

          {description && (
            <p className={styles.productDesc}>{description}</p>
          )}

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
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnPedir}
              onClick={e => {
                if (variants.length > 0 && !selectedVariant) {
                  e.preventDefault()
                  setVariantError(true)
                }
              }}
            >
              <MessageCircle size={18} aria-hidden="true" />
              Pedir ahora · {fmtUsd(effectivePrice * qty)}
            </a>
            <button
              type="button"
              className={styles.btnShare}
              onClick={() => navigator.share?.({ title: name, url: window.location.href }).catch(() => {})}
              aria-label="Compartir"
            >
              <Share2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
