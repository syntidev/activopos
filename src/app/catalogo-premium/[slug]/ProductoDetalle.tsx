'use client'

import { useEffect, useState, useMemo, useRef, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Share2, Plus, Minus, Zap, ShoppingBag, Ruler,
  Search, Info, X, MessageCircle, AtSign, Phone,
} from 'lucide-react'
import Link from 'next/link'
import type { CatalogProductVariant, PaymentMethod } from './CatalogoGrid'
import { useCart } from './CartContext'
import { CartHeaderButton } from './CartHeaderButton'
import { CartDrawer } from './CartDrawer'
import { SizeGuideModal } from './SizeGuideModal'
import { hasSizeGuide } from '@/lib/size-guide'
import { PRESET_GROUPS } from '@/lib/variantPresets'
import { fmtUsd, fmtBs, capitalize, currencyVisibility, categoryBadgeColor, getConsultarWaUrl } from './catalogUtils'
import { normalizePhone } from '@/lib/utils'
import styles from './productoDetalle.module.css'
import { AdaptiveGrid } from '@/components/ui/AdaptiveGrid'
// Mismo header/panel de info que Home y /productos (CatalogoGrid.tsx) --
// clases de catalogo.module.css, no duplicadas en productoDetalle.module.css.
// Antes esta página tenía un "mini header" propio (solo logo+carrito), lo
// que rompía la consistencia pedida ("mismo logo, misma altura, mismo
// comportamiento" en las 3 páginas reales del árbol catalogo-premium).
import catStyles from './catalogo.module.css'

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

interface RelatedProduct {
  id:       number
  name:     string
  image:    string | null
  priceUsd: number
}

interface AdjacentProduct {
  id:   number
  name: string
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
  priceDivisa:   number | null
  variants:      CatalogProductVariant[]
  businessName:  string
  slug:          string
  rate:          number
  currency:      string
  paymentMethods: PaymentMethod[]
  catalogUrl:    string
  relatedProducts: RelatedProduct[]
  prevProduct:   AdjacentProduct | null
  nextProduct:   AdjacentProduct | null
  businessLogo:  string | null
  businessCity:      string | null
  businessDesc:      string | null
  businessPhone:     string
  businessInstagram: string | null
  businessHours:     string | null
}

export function ProductoDetalle({
  productId, name, description, images, categoryName, categoryColor,
  priceUsd, priceBs, priceDivisa, variants, businessName,
  catalogUrl, rate, currency, slug, paymentMethods, relatedProducts, prevProduct, nextProduct, businessLogo,
  businessCity, businessDesc, businessPhone, businessInstagram, businessHours,
}: Props) {
  const router = useRouter()
  const { showUsd, showBs } = currencyVisibility(currency)
  const { addToCart, cartOpen, checkoutOpen, setCartOpen, setCheckoutOpen } = useCart()
  const [imageIndex,        setImageIndex]        = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [selectedDim1,      setSelectedDim1]      = useState<string | null>(null)
  const [qty,               setQty]               = useState(1)
  const [variantError,      setVariantError]      = useState(false)
  const [sizeGuideOpen,     setSizeGuideOpen]      = useState(false)

  // Estado del header compartido (mismo patrón que CatalogoGrid): glass-on-scroll,
  // búsqueda expandible, panel de info. Esta página no tiene lista de productos
  // que filtrar -- buscar navega a /productos?buscar= en vez de filtrar in-place.
  const [isScrolled,     setIsScrolled]     = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [infoOpen,       setInfoOpen]       = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const initials  = getInitials(businessName)

  // El scroll vive en `.root` (page.tsx), no en window -- mismo criterio que
  // CatalogoGrid. Acá el header NO es hijo directo de `.root`: esta página
  // envuelve todo en su propio `.page` (productoDetalle.module.css), así que
  // hay que subir 2 niveles, no 1.
  useEffect(() => {
    const scroller = headerRef.current?.parentElement?.parentElement
    if (!scroller) return
    const onScroll = () => setIsScrolled(scroller.scrollTop > 8)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchExpanded) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [searchExpanded])

  const submitSearch = () => {
    const q = searchQuery.trim()
    router.push(`/catalogo-premium/${slug}/productos${q ? `?buscar=${encodeURIComponent(q)}` : ''}`)
  }

  // Scroll lock — el drawer/checkout del carrito puede abrirse desde esta página también
  useEffect(() => {
    const locked = cartOpen || checkoutOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, checkoutOpen])

  const selectedVariant  = variants.find(v => v.id === selectedVariantId) ?? null
  // precio_bcv (normal): base de la conversión a Bs, siempre -- sin importar
  // si hay precio_divisa. Se muestra tachado cuando precio_divisa existe.
  const effectivePrice   = priceUsd + (selectedVariant?.precio_extra ?? 0)
  const effectivePriceBs = priceBs !== null
    ? effectivePrice * rate
    : null
  // Precio final real: precio_divisa (si existe) es lo que se cobra y se
  // destaca en $ -- no un tachado decorativo. Bs arriba sigue de precio_bcv.
  const effectivePriceFinal = (priceDivisa ?? priceUsd) + (selectedVariant?.precio_extra ?? 0)

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

  // Variantes combinadas (talla+color…): combination_key = "S-Azul", tipo = "talla+color".
  // Mismo patrón que CatalogoGrid — dim1 (talla) filtra las opciones de dim2 (color);
  // solo al elegir dim2 se fija selectedVariantId (la fila real con stock/precio).
  // every() y no some(): con una sola variante sin combination_key, el map de
  // abajo hace .split() sobre null y tumba el catalogo. Mixto => se trata legacy.
  const isCombinedVariant = variants.length > 0 && variants.every(v => v.combination_key)
  // Guía de tallas: solo para el preset de una dimensión (talla/color simple)
  // y solo si la categoría tiene tabla de referencia — colores/ropa infantil
  // no tienen, se oculta el link en vez de abrir un modal vacío.
  const sizeGuideCategory = !isCombinedVariant
    ? variants.find(v => v.variant_group && hasSizeGuide(v.variant_group))?.variant_group ?? null
    : null
  const combinedDimLabels = isCombinedVariant ? (variants[0]?.tipo ?? '').split('+') : []
  const combinedDim1Label = combinedDimLabels[0] ?? 'Talla'
  const combinedDim2Label = combinedDimLabels[1] ?? 'Color'
  const combinedDim1Options = isCombinedVariant
    ? Array.from(new Set(variants.map(v => v.combination_key!.split('-')[0])))
    : []
  const combinedDim2Options = isCombinedVariant && selectedDim1 !== null
    ? variants.filter(v => v.combination_key!.startsWith(`${selectedDim1}-`))
    : []

  // Agrega el producto actual (con la variante/cantidad elegida) al carrito.
  // Devuelve false si falta elegir variante — ambos CTAs (Agregar / Pedir
  // ahora) comparten esta misma validación y forma de item.
  const addCurrentToCart = (): boolean => {
    if (variants.length > 0 && !selectedVariant) { setVariantError(true); return false }
    addToCart({
      product_id:    productId,
      name,
      qty,
      price_usd:     effectivePriceFinal,
      image_url:     images[0] ?? null,
      variant_id:    selectedVariant?.id,
      variant_label: selectedVariant ? `${capitalize(selectedVariant.tipo)}: ${selectedVariant.valor}` : undefined,
    })
    return true
  }

  return (
    <div className={styles.page}>

      {/* Header idéntico a Home/productos -- mismas clases de catalogo.module.css,
          mismo comportamiento (glass-on-scroll, búsqueda expandible, panel de
          info), solo cambia qué hace "buscar" (acá navega, no filtra in-place). */}
      <header ref={headerRef} className={`${catStyles.stickyHeader} ${isScrolled ? catStyles.stickyHeaderScrolled : ''}`}>
        <Link href={catalogUrl} className={catStyles.headerLogo} aria-label={`Ir al inicio de ${businessName}`}>
          {businessLogo ? (
            <img src={businessLogo} alt={businessName} className={catStyles.headerLogoImg} />
          ) : (
            <span className={catStyles.headerLogoInitials} aria-hidden="true">{initials}</span>
          )}
          <span className={catStyles.headerInfo}>
            <span className={catStyles.headerNameRow}>
              <span className={catStyles.headerName}>{businessName}</span>
              <span className={catStyles.headerStatusDot} aria-label="Abierto" title="Abierto" />
            </span>
            {businessCity && <span className={catStyles.headerCity}>{businessCity}</span>}
          </span>
        </Link>

        <nav className={catStyles.headerNav} aria-label="Navegación principal">
          <Link href={catalogUrl} className={catStyles.headerNavLink}>Inicio</Link>
          <Link href={`/catalogo-premium/${slug}/productos`} className={catStyles.headerNavLink}>Tienda</Link>
          <Link href={`${catalogUrl}#marcas`} className={catStyles.headerNavLink}>Marcas</Link>
        </nav>

        <div className={catStyles.iconCluster}>
          <button
            type="button"
            className={catStyles.desktopSearchBtn}
            onClick={() => setSearchExpanded(true)}
            aria-label="Buscar productos"
          >
            <Search size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={catStyles.infoBtn}
            onClick={() => setInfoOpen(true)}
            aria-label="Información del negocio"
          >
            <Info size={20} aria-hidden="true" />
          </button>
          <CartHeaderButton />
        </div>
      </header>

      {searchExpanded && (
        <div className={catStyles.navBar}>
          <div className={catStyles.searchExpanded} role="search">
            <Search size={16} className={catStyles.searchExpandedIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              className={catStyles.searchExpandedInput}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSearch() }}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
            />
            <button
              type="button"
              className={catStyles.searchExpandedClose}
              onClick={() => { setSearchExpanded(false); setSearchQuery('') }}
              aria-label="Cerrar búsqueda"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {infoOpen && (
        <div className={catStyles.infoOverlay} onClick={() => setInfoOpen(false)}>
          <div
            className={catStyles.infoPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Información del negocio"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className={catStyles.infoPanelClose}
              onClick={() => setInfoOpen(false)}
              aria-label="Cerrar información"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className={catStyles.infoBizHeader}>
              {businessLogo ? (
                <img src={businessLogo} alt={businessName} className={catStyles.infoBizLogo} />
              ) : (
                <div className={catStyles.infoBizInitials} aria-hidden="true">{initials}</div>
              )}
              <div>
                <h2 className={catStyles.infoBizName}>{businessName}</h2>
                {businessDesc && <p className={catStyles.infoBizDesc}>{businessDesc}</p>}
                {businessCity && <p className={catStyles.infoBizCity}>{businessCity}</p>}
              </div>
            </div>

            {paymentMethods.length > 0 && (
              <div className={catStyles.infoSection}>
                <p className={catStyles.infoSectionLabel}>Métodos de pago</p>
                <div className={catStyles.infoPayMethods}>
                  {paymentMethods.map(m => (
                    <span key={m.id} className={catStyles.infoPayPill}>{m.name}</span>
                  ))}
                </div>
              </div>
            )}

            {(businessPhone || businessInstagram) && (
              <div className={catStyles.infoSection}>
                <p className={catStyles.infoSectionLabel}>Contáctanos</p>
                <div className={catStyles.infoContacts}>
                  {businessPhone && (
                    <a
                      href={`https://wa.me/${normalizePhone(businessPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={catStyles.infoContactBtn}
                      style={{ '--btn-color': '#25D366' } as CSSProperties}
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  {businessInstagram && (
                    <a
                      href={`https://instagram.com/${businessInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={catStyles.infoContactBtn}
                      style={{ '--btn-color': '#E1306C' } as CSSProperties}
                    >
                      <AtSign size={18} aria-hidden="true" />
                      <span>Instagram</span>
                    </a>
                  )}
                  {businessPhone && (
                    <a
                      href={`tel:+${businessPhone}`}
                      className={catStyles.infoContactBtn}
                      style={{ '--btn-color': 'var(--biz-color)' } as CSSProperties}
                    >
                      <Phone size={18} aria-hidden="true" />
                      <span>Llamar</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {businessHours && (
              <div className={catStyles.infoSection}>
                <p className={catStyles.infoSectionLabel}>Horario de atención</p>
                <p className={catStyles.infoHours}>{businessHours}</p>
              </div>
            )}

            <button
              type="button"
              className={catStyles.infoShareBtn}
              onClick={() => {
                navigator.share?.({ title: businessName, url: window.location.href }).catch(() => {})
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              Compartir catálogo
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb + Anterior/Siguiente dentro de la misma categoría (o del
          catálogo completo si el producto no tiene categoría) -- mismo orden
          que la home (sort_order), ver prevProduct/nextProduct en page.tsx. */}
      <nav className={styles.breadcrumb} aria-label="Navegación">
        <div className={styles.breadcrumbLeft}>
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
        </div>
        {(prevProduct || nextProduct) && (
          <div className={styles.adjacentNav} aria-label="Producto anterior y siguiente">
            {prevProduct ? (
              <Link href={`/catalogo-premium/${slug}/p/${prevProduct.id}`} className={styles.adjacentLink} title={prevProduct.name}>
                <ArrowLeft size={14} aria-hidden="true" />
                Anterior
              </Link>
            ) : (
              <span className={`${styles.adjacentLink} ${styles.adjacentLinkDisabled}`} aria-hidden="true">
                <ArrowLeft size={14} aria-hidden="true" />
                Anterior
              </span>
            )}
            <span className={styles.breadcrumbSep} aria-hidden="true">|</span>
            {nextProduct ? (
              <Link href={`/catalogo-premium/${slug}/p/${nextProduct.id}`} className={styles.adjacentLink} title={nextProduct.name}>
                Siguiente
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : (
              <span className={`${styles.adjacentLink} ${styles.adjacentLinkDisabled}`} aria-hidden="true">
                Siguiente
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            )}
          </div>
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
              style={{ '--badge-color': categoryBadgeColor(categoryName, categoryColor) } as CSSProperties}
            >
              {categoryName.toUpperCase()}
            </span>
          )}

          <h1 className={styles.productName}>{name}</h1>

          <div className={styles.priceBlock}>
            {showUsd && (
              <>
                {priceDivisa !== null && priceDivisa > 0 && (
                  <span className={styles.priceUsdOld}>{fmtUsd(effectivePrice)}</span>
                )}
                <span className={styles.priceUsd}>{fmtUsd(effectivePriceFinal)}</span>
              </>
            )}
            {showBs && effectivePriceBs !== null && (
              <span className={styles.priceBs}>{fmtBs(effectivePriceBs)}</span>
            )}
          </div>

          {/* Variantes */}
          {variantGroups.length > 0 && (
            <div className={styles.variants}>
              {isCombinedVariant ? (
                <>
                  <div className={styles.variantGroup}>
                    <span className={styles.variantLabel}>{capitalize(combinedDim1Label)}</span>
                    <div className={styles.variantChips}>
                      {combinedDim1Options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.variantChip} ${selectedDim1 === opt ? styles.variantChipActive : ''}`}
                          onClick={() => { setSelectedDim1(opt); setSelectedVariantId(null); setVariantError(false) }}
                          aria-pressed={selectedDim1 === opt}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedDim1 !== null && (
                    <div className={styles.variantGroup}>
                      <span className={styles.variantLabel}>{capitalize(combinedDim2Label)}</span>
                      <div className={styles.variantChips}>
                        {combinedDim2Options.map(v => {
                          const soldOut = v.stock <= 0
                          const active  = selectedVariantId === v.id
                          const label   = v.combination_key!.slice(selectedDim1.length + 1)
                          return (
                            <button
                              key={v.id}
                              type="button"
                              className={`${styles.variantChip} ${active ? styles.variantChipActive : ''} ${soldOut ? styles.variantChipDisabled : ''}`}
                              onClick={() => { setSelectedVariantId(v.id); setVariantError(false) }}
                              disabled={soldOut}
                              aria-pressed={active}
                              aria-label={`${combinedDim2Label}: ${label}${soldOut ? ' — agotado' : ''}`}
                            >
                              {label}
                              {soldOut && <span className={styles.soldOutLabel}>Agotado</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                variantGroups.map(g => {
                  // Si alguna variante trae variant_group con preset conocido, se
                  // completa la grilla con las tallas faltantes de ese preset
                  // (deshabilitadas "No disponible") -- pedido explícito: producto
                  // con variantes parciales debe mostrar el preset completo, no
                  // solo las tallas cargadas.
                  const presetId = g.options.find(v => v.variant_group)?.variant_group ?? null
                  const preset   = presetId ? PRESET_GROUPS.find(p => p.id === presetId) : null
                  const slots: { value: string; variant: CatalogProductVariant | null }[] = preset
                    ? preset.values.map(val => ({ value: val, variant: g.options.find(o => o.valor === val) ?? null }))
                    : g.options.map(v => ({ value: v.valor, variant: v }))

                  return (
                    <div key={g.tipo} className={styles.variantGroup}>
                      <span className={styles.variantLabel}>{capitalize(g.tipo)}</span>
                      <div className={styles.variantChips}>
                        {slots.map(({ value, variant: v }) => {
                          if (!v) {
                            return (
                              <button
                                key={value}
                                type="button"
                                className={`${styles.variantChip} ${styles.variantChipDisabled}`}
                                disabled
                                aria-label={`${capitalize(g.tipo)}: ${value} — no disponible`}
                              >
                                {value}
                                <span className={styles.soldOutLabel}>No disponible</span>
                              </button>
                            )
                          }
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
                              {v.valor}{v.sku ? ` (${v.sku})` : ''}
                              {soldOut && <span className={styles.soldOutLabel}>Agotado</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
              {variantError && (
                <p className={styles.variantError}>Selecciona una opción para continuar</p>
              )}
              {sizeGuideCategory && (
                <button
                  type="button"
                  className={styles.sizeGuideLink}
                  onClick={() => setSizeGuideOpen(true)}
                >
                  <Ruler size={14} aria-hidden="true" />
                  Ver guía de tallas
                </button>
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
            {/* Directo desde la ficha, no solo al final del carrito. */}
            {businessPhone && (
              <a
                href={getConsultarWaUrl(businessPhone, name)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnWhatsapp}
                aria-label={`Consultar ${name} por WhatsApp`}
              >
                <MessageCircle size={18} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              className={styles.btnPedir}
              onClick={() => { if (addCurrentToCart()) setCheckoutOpen(true) }}
            >
              <Zap size={18} aria-hidden="true" />
              Pedir ahora · {showUsd ? fmtUsd(effectivePriceFinal * qty) : fmtBs(effectivePrice * qty * rate)}
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
          <AdaptiveGrid max={{ mobile: 2, tablet: 4, desktop: 4 }}>
            {relatedProducts.map(rp => (
              <Link
                key={rp.id}
                href={`/catalogo-premium/${slug}/p/${rp.id}`}
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
                <p className={styles.relatedPrice}>
                  {showUsd ? fmtUsd(rp.priceUsd) : fmtBs(rp.priceUsd * rate)}
                </p>
              </Link>
            ))}
          </AdaptiveGrid>
        </section>
      )}

      <CartDrawer slug={slug} rate={rate} currency={currency} paymentMethods={paymentMethods} />
      {sizeGuideCategory && (
        <SizeGuideModal
          open={sizeGuideOpen}
          category={sizeGuideCategory}
          onClose={() => setSizeGuideOpen(false)}
        />
      )}
    </div>
  )
}
