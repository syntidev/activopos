'use client'

import { useState, useMemo, useRef, useEffect, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, X, MessageCircle, ShoppingBag, Plus, Minus, Search,
  Star, Archive, Menu, Flame, Sparkles, Tag, ThumbsUp,
  Info, AtSign, Phone, Share2, ArrowUp, SlidersHorizontal, LayoutGrid, Grid,
} from 'lucide-react'
import { useCart } from './CartContext'
import { CartHeaderButton } from './CartHeaderButton'
import { CartDrawer } from './CartDrawer'
import { capitalize } from './catalogUtils'
import styles from './catalogo.module.css'

/* ── Public interfaces ───────────────────────────────────────── */

export interface CatalogProductVariant {
  id:              number
  tipo:            string
  valor:           string
  stock:           number
  precio_extra:    number
  combination_key: string | null
}

export interface CatalogProduct {
  id:                number
  name:              string
  description:       string | null
  image:             string | null
  images:            string[]
  categoryName:      string | null
  priceUsd:          number
  priceBs:           number | null
  outOfStock:        boolean
  isService:         boolean
  stockQty:          number | null
  badge:             string | null
  subcategory:       string | null
  isFeatured:        boolean
  catalogVisibility: 'visible' | 'on_request' | 'hidden'
  availability:      'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  variants:          CatalogProductVariant[]
}

export interface PaymentMethod {
  id:   number
  name: string
  type: string
}

/* ── Internal types ──────────────────────────────────────────── */

interface Props {
  products:       CatalogProduct[]
  categories:     string[]
  categoryColors: Record<string, string | null>
  categoryImages: Record<string, string | null>
  slug:           string
  rate:           number
  paymentMethods: PaymentMethod[]
  businessPhone:  string
  businessName:   string
  businessLogo:   string | null
  businessCity:   string | null
  businessDesc:   string | null
  heroCover?:     string | null
  heroCovers?:    string[]
  businessHours:     string | null
  businessInstagram: string | null
  // Stub temporal CLI-A (Sprint 91) — CLI-B agrega el render en footer
  businessLegalName?: string | null | undefined
  businessRif?:       string | null | undefined
  businessAddress?:   string | null | undefined
  catalogMode?:       'home' | 'productos'
  initialCategory?:   string | null
}

/* ── Helpers ─────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

function getConsultarWaUrl(phone: string, productName: string): string {
  if (!phone) return '#'
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, quiero consultar disponibilidad de: ${productName}`)}`
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

const FEATURED_KEY = '__destacados__'

/* ── Component ───────────────────────────────────────────────── */

export function CatalogoGrid({
  products,
  categories,
  categoryColors,
  categoryImages,
  slug,
  rate,
  paymentMethods,
  businessPhone,
  businessName,
  businessLogo,
  businessCity,
  businessDesc,
  heroCover,
  heroCovers,
  businessHours,
  businessInstagram,
  catalogMode = 'home',
  initialCategory = null,
}: Props) {
  const router = useRouter()
  const { cart, cartOpen, setCartOpen, checkoutOpen, addToCart: addItemToCart } = useCart()

  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory)
  const [activeSub,      setActiveSub]      = useState<string | null>(null)
  const [query,          setQuery]          = useState('')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [modalQty,       setModalQty]       = useState(1)
  const [catMenuOpen,    setCatMenuOpen]    = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [infoOpen,       setInfoOpen]       = useState(false)
  const [visibleCount,   setVisibleCount]   = useState(10)
  const [spyCategory,    setSpyCategory]    = useState<string | null>(null)
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [variantError,    setVariantError]    = useState(false)
  const [selectedDim1,    setSelectedDim1]    = useState<string | null>(null)
  const [showBackTop,    setShowBackTop]    = useState(false)
  const [heroIdx,        setHeroIdx]        = useState(0)

  const closeRef  = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const categoryTrackRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  // El scroll vive en `.root` (page.tsx), no en window. El header es hijo directo
  // de `.root`, así que su parentElement es el contenedor scrolleable.
  const getScroller = (): HTMLElement | null => headerRef.current?.parentElement ?? null

  const scrollToTop = () => {
    getScroller()?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Muestra "volver al inicio" tras bajar una pantalla
  useEffect(() => {
    const scroller = getScroller()
    if (!scroller) return
    const onScroll = () => setShowBackTop(scroller.scrollTop > 600)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  const hasFeatured = useMemo(() => products.some(p => p.isFeatured), [products])
  const initials    = getInitials(businessName)

  // Sin created_at en CatalogProduct — badge 'nuevo' como proxy de ingreso reciente
  const nuevosIngresos = useMemo(() =>
    products
      .filter(p => p.badge === 'nuevo' && !p.outOfStock)
      .slice(0, 8)
  , [products])

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (p.categoryName) map.set(p.categoryName, (map.get(p.categoryName) ?? 0) + 1)
    }
    return map
  }, [products])

  // Categoría de contexto para el bar de subcategorías: en modo filtrado es
  // activeCategory; en browse sigue a la sección visible (scroll-spy).
  const subcatContext = activeCategory && activeCategory !== FEATURED_KEY
    ? activeCategory
    : spyCategory

  const subcategoriesForActive = useMemo(() => {
    if (!subcatContext) return []
    const subs = new Set<string>()
    for (const p of products) {
      if (p.categoryName === subcatContext && p.subcategory) subs.add(p.subcategory)
    }
    return Array.from(subs).sort()
  }, [products, subcatContext])

  useEffect(() => { setActiveSub(null) }, [activeCategory])

  // Auto-avance del slider del hero — pausa si solo hay 0-1 imagen
  useEffect(() => {
    const covers = heroCovers ?? (heroCover ? [heroCover] : [])
    if (covers.length <= 1) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % covers.length), 5000)
    return () => clearInterval(t)
  }, [heroCovers, heroCover])

  // Focus the search input when the lupa expands it
  useEffect(() => {
    if (searchExpanded) {
      const t = setTimeout(() => searchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [searchExpanded])

  const visible = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return products.filter(p =>
        p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
        (p.categoryName?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '').includes(q),
      )
    }
    if (activeCategory === FEATURED_KEY) return products.filter(p => p.isFeatured)
    const byCat = activeCategory ? products.filter(p => p.categoryName === activeCategory) : products
    return activeSub ? byCat.filter(p => p.subcategory === activeSub) : byCat
  }, [products, query, activeCategory, activeSub])

  // Reset paginación al cambiar filtro o búsqueda — patrón SYNTImeat
  useEffect(() => { setVisibleCount(10) }, [activeCategory, activeSub, query])

  const paged     = visible.slice(0, visibleCount)
  const remaining = visible.length - visibleCount

  // ── Modo browse: vitrina apilada por categoría con scroll-spy ──
  // Activo solo sin filtro de categoría real ni búsqueda; Destacados y
  // subcategorías siguen usando el grid filtrado único de arriba.
  const browseMode = activeCategory === null && !query.trim()

  const ORPHAN_KEY = '__otros__'

  const sections = useMemo(() => {
    const byCat = new Map<string, CatalogProduct[]>()
    for (const cat of categories) byCat.set(cat, [])
    const orphans: CatalogProduct[] = []
    for (const p of products) {
      const list = p.categoryName ? byCat.get(p.categoryName) : undefined
      if (list) list.push(p)
      else orphans.push(p)
    }
    const out = categories
      .map(name => ({ key: name, name, color: categoryColors[name] ?? null, items: byCat.get(name) ?? [] }))
      .filter(s => s.items.length > 0)
    if (orphans.length) out.push({ key: ORPHAN_KEY, name: 'Otros', color: null, items: orphans })
    return out
  }, [products, categories, categoryColors])

  const catSectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Scroll-spy: resalta el tab de la sección más visible (solo en browse)
  useEffect(() => {
    if (!browseMode || sections.length < 2) return
    const observer = new IntersectionObserver(
      entries => {
        let best: IntersectionObserverEntry | null = null
        for (const e of entries) {
          if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e
        }
        if (best) {
          const key = best.target.getAttribute('data-cat-key')
          if (key) {
            const resolved = key === ORPHAN_KEY ? null : key
            setSpyCategory(prev => {
              // Centra el chip del tab en el track horizontal cuando el scroll-spy
              // cambia de categoría — antes solo pasaba en clicks explícitos de tab.
              if (resolved && resolved !== prev) centerChip(resolved)
              return resolved
            })
          }
        }
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.15, 0.4] },
    )
    Array.from(catSectionRefs.current.values()).forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [browseMode, sections])

  // addToCart adapta la forma de CatalogProduct al item plano que espera CartContext
  const addToCart = (product: CatalogProduct, qty: number, variant?: CatalogProductVariant) => {
    addItemToCart({
      product_id:    product.id,
      name:          product.name,
      qty,
      price_usd:     product.priceUsd + (variant?.precio_extra ?? 0),
      image_url:     product.image,
      variant_id:    variant?.id,
      variant_label: variant ? `${capitalize(variant.tipo)}: ${variant.valor}` : undefined,
    })
  }

  // Centra el chip activo dentro del track horizontal
  const centerChip = (cat: string) => {
    const track = categoryTrackRef.current
    if (!track) return
    const activeBtn = track.querySelector<HTMLElement>(`[data-category="${cat}"]`)
    if (!activeBtn) return
    const trackRect = track.getBoundingClientRect()
    const btnRect   = activeBtn.getBoundingClientRect()
    const scrollLeft = track.scrollLeft + (btnRect.left - trackRect.left)
      - (trackRect.width / 2) + (btnRect.width / 2)
    track.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }

  // Entra en modo filtrado (Destacados / desde el menú de categorías)
  const selectCategory = (cat: string | null) => {
    setActiveCategory(cat)
    if (cat && cat !== FEATURED_KEY) centerChip(cat)
  }

  // En catalogMode='productos' no hay shelves — el grid siempre es plano,
  // así que un click de categoría debe filtrar (no hay sección a la que scrollear)
  const handleCatClick = (cat: string | null) => {
    if (catalogMode === 'productos') { selectCategory(cat); return }
    scrollToSection(cat)
  }

  // Navegación pura (paradigma food): scrollea a la sección sin filtrar
  const scrollToSection = (cat: string | null) => {
    setActiveCategory(null)
    setActiveSub(null)
    setQuery('')
    if (cat === null) {
      setSpyCategory(null)
      scrollToTop()
      return
    }
    setSpyCategory(cat)
    centerChip(cat)
    // Espera un frame por si venimos de modo filtrado y la sección aún no montó
    requestAnimationFrame(() => {
      const el = catSectionRefs.current.get(cat)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Resaltado del tab: en browse sigue al scroll-spy; Destacados es filtro real
  const tabActive = (cat: string | null): boolean => {
    if (cat === FEATURED_KEY) return activeCategory === FEATURED_KEY
    return browseMode && spyCategory === cat
  }

  const openModal  = (p: CatalogProduct) => {
    setSelectedProduct(p); setModalQty(1); setModalImageIndex(0)
    setSelectedVariantId(null); setVariantError(false); setSelectedDim1(null)
  }
  const closeModal = () => setSelectedProduct(null)

  // Scroll lock — solo cubre el modal de producto; el drawer/checkout del
  // carrito bloquea su propio scroll dentro de CartDrawer (mismo cartOpen).
  useEffect(() => {
    const locked = !!selectedProduct
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedProduct])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (catMenuOpen)     { setCatMenuOpen(false); return }
      if (searchExpanded)  { setSearchExpanded(false); setQuery(''); return }
      if (selectedProduct) { closeModal(); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedProduct, catMenuOpen, searchExpanded])

  // Focus trap del modal de producto
  useEffect(() => {
    if (!selectedProduct) return
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [selectedProduct])

  const selP = selectedProduct

  const variantGroups = useMemo(() => {
    if (!selP?.variants.length) return [] as { tipo: string; options: CatalogProductVariant[] }[]
    const map = new Map<string, CatalogProductVariant[]>()
    for (const v of selP.variants) {
      if (!map.has(v.tipo)) map.set(v.tipo, [])
      map.get(v.tipo)!.push(v)
    }
    return Array.from(map.entries()).map(([tipo, options]) => ({ tipo, options }))
  }, [selP])

  const selectedVariant = selP?.variants.find(v => v.id === selectedVariantId) ?? null

  // Cap de cantidad: stock de la variante elegida, o del producto si no hay
  // variante seleccionada (o no tiene variantes). null (servicios) = sin tope.
  const availableStock = selectedVariant
    ? selectedVariant.stock
    : (selP?.stockQty ?? Infinity)

  // Si el stock disponible baja (cambio de variante) por debajo de la
  // cantidad ya elegida, la re-ajusta — evita overselling al cambiar de talla.
  useEffect(() => {
    setModalQty(q => Math.min(q, Math.max(1, availableStock)))
  }, [availableStock])

  // Variantes combinadas (talla+color…): combination_key = "S-Azul", tipo = "talla+color".
  // every() y no some(): con una sola variante sin combination_key, el map de
  // abajo hace .split() sobre null y tumba el catalogo. Mixto => se trata legacy.
  const isCombinedVariant = !!selP && selP.variants.length > 0 && selP.variants.every(v => v.combination_key)
  const combinedDimLabels = isCombinedVariant ? (selP!.variants[0]?.tipo ?? '').split('+') : []
  const combinedDim1Label = combinedDimLabels[0] ?? 'Talla'
  const combinedDim2Label = combinedDimLabels[1] ?? 'Color'
  const combinedDim1Options = isCombinedVariant
    ? Array.from(new Set(selP!.variants.map(v => v.combination_key!.split('-')[0])))
    : []
  const combinedDim2Options = isCombinedVariant && selectedDim1 !== null
    ? selP!.variants.filter(v => v.combination_key!.startsWith(`${selectedDim1}-`))
    : []

  // Card de producto — compartida entre secciones browse y grid filtrado.
  // accentColor pinta el borde superior (--accent-cat); cae a --biz-color.
  const renderProductCard = (p: CatalogProduct, i: number, accentColor?: string | null) => {
    const isOut = p.outOfStock || p.availability === 'out_of_stock'
    const cardStyle: CSSProperties = { '--card-index': Math.min(i, 12) } as CSSProperties
    if (accentColor) (cardStyle as Record<string, string>)['--accent-cat'] = accentColor
    return (
      <article
        key={p.id}
        className={`${styles.productCard} ${isOut ? styles.productCardOutOfStock : ''}`}
        style={cardStyle}
        onClick={() => router.push(`/catalogo/${slug}/p/${p.id}`)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/catalogo/${slug}/p/${p.id}`) }
        }}
        tabIndex={isOut ? -1 : 0}
        role="button"
        aria-label={`Ver detalle: ${p.name}`}
      >
        <div className={styles.productImageWrap}>
          <span className={styles.productCardAccent} aria-hidden="true" />
          {p.image ? (
            <img
              src={p.image}
              alt={p.name}
              className={styles.productImage}
              loading="lazy"
              ref={img => { if (img?.complete) img.classList.add(styles.productImageLoaded) }}
              onLoad={e => e.currentTarget.classList.add(styles.productImageLoaded)}
            />
          ) : (
            <div className={`${styles.productImagePlaceholder} ${styles.gradDefault}`} aria-hidden="true">
              <span className={styles.productInitial}>{p.name.charAt(0).toUpperCase()}</span>
            </div>
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
          ) : p.stockQty !== null && p.stockQty > 0 ? (
            <span className={styles.badgeStock}>
              {p.stockQty <= 5 ? `Últimas ${p.stockQty}` : `${p.stockQty} uds.`}
            </span>
          ) : null}

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
        </div>

        <div className={styles.productInfo}>
          {p.categoryName && <p className={styles.productCategory}>{p.categoryName}</p>}
          <h2 className={styles.productName}>{p.name}</h2>

          {/* Rating placeholder estático (sin data de reseñas todavía) -- señal de
              "tienda real", mismo patrón que la referencia. Cero lógica/estado. */}
          <span className={styles.productStars} aria-hidden="true">
            <span className={styles.productStarsIcons}>☆☆☆☆☆</span>
            <span className={styles.productStarsLabel}>Sin reseñas</span>
          </span>

          {/* Precios — sin botón circular */}
          <div className={styles.productPriceBlock}>
            {p.catalogVisibility === 'on_request' ? (
              <span className={styles.priceConsultar}>Consultar precio</span>
            ) : p.availability === 'discontinued' ? (
              <span className={styles.priceDiscontinued}>No disponible</span>
            ) : p.priceUsd > 0 ? (
              <>
                <span className={styles.priceUsd}>
                  ${p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                {p.priceBs && (
                  <span className={styles.priceBs}>
                    Bs.&nbsp;{p.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </>
            ) : (
              <span className={styles.priceConsultar}>Consultar precio</span>
            )}
          </div>
        </div>

        {/* Botón Agregar full-width — fuera del productInfo, al pie del article */}
        {p.catalogVisibility !== 'on_request' &&
          p.availability !== 'discontinued' &&
          !isOut &&
          p.availability !== 'out_of_stock' &&
          p.priceUsd > 0 && (
          <button
            type="button"
            className={styles.addBtnFull}
            onClick={e => {
              e.stopPropagation()
              p.variants.length > 0
                ? router.push(`/catalogo/${slug}/p/${p.id}`)
                : addToCart(p, 1)
            }}
            aria-label={
              p.variants.length > 0
                ? `Ver opciones de ${p.name}`
                : `Agregar ${p.name} al carrito`
            }
          >
            <ShoppingBag size={15} aria-hidden="true" />
            {p.variants.length > 0 ? 'Ver opciones' : 'Agregar'}
          </button>
        )}
      </article>
    )
  }

  return (
    <>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header ref={headerRef} className={styles.stickyHeader}>
        <Link
          href={`/catalogo/${slug}`}
          className={styles.headerLogo}
          aria-label={`Ir al inicio de ${businessName}`}
        >
          {businessLogo ? (
            <img
              src={businessLogo}
              alt={businessName}
              className={styles.headerLogoImg}
            />
          ) : (
            <span className={styles.headerLogoInitials} aria-hidden="true">
              {initials}
            </span>
          )}
          <span className={styles.headerInfo}>
            <span className={styles.headerNameRow}>
              <span className={styles.headerName}>{businessName}</span>
              <span className={styles.headerStatusDot} aria-label="Abierto" title="Abierto" />
            </span>
            {businessCity && (
              <span className={styles.headerCity}>{businessCity}</span>
            )}
          </span>
        </Link>

        <button
          type="button"
          className={styles.infoBtn}
          onClick={() => setInfoOpen(true)}
          aria-label="Información del negocio"
        >
          <Info size={20} aria-hidden="true" />
        </button>

        <CartHeaderButton />
      </header>

      {/* ── H2: Navegación + búsqueda expandible (sticky) ──────── */}
      <div className={styles.navBar}>
        {searchExpanded ? (
          <div className={styles.searchExpanded} role="search">
            <Search size={16} className={styles.searchExpandedIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              className={styles.searchExpandedInput}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
            />
            <button
              type="button"
              className={styles.searchExpandedClose}
              onClick={() => { setSearchExpanded(false); setQuery('') }}
              aria-label="Cerrar búsqueda"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={styles.navIconBtn}
              onClick={() => setCatMenuOpen(o => !o)}
              aria-label="Ver todas las categorías"
              aria-expanded={catMenuOpen}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.navIconBtn}
              onClick={() => setSearchExpanded(true)}
              aria-label="Buscar productos"
            >
              <Search size={18} aria-hidden="true" />
            </button>

            <nav className={styles.desktopNav} aria-label="Navegación principal">
              <Link href={`/catalogo/${slug}`} className={styles.desktopNavLink}>Inicio</Link>
              <Link href={`/catalogo/${slug}/productos`} className={styles.desktopNavLink}>Catálogo</Link>
            </nav>

            {(catalogMode === 'productos' || !browseMode) && (
              <div
                ref={categoryTrackRef}
                className={`${styles.categoryTrack} ${catalogMode === 'productos' ? styles.catalogChipsHideDesktop : ''}`}
                role="tablist"
                aria-label="Filtrar por categoría"
              >
                <button
                  role="tab"
                  aria-selected={tabActive(null)}
                  className={`${styles.categoryTab} ${tabActive(null) ? styles.categoryTabActive : ''}`}
                  onClick={() => handleCatClick(null)}
                >
                  Todos
                  <span className={styles.categoryTabCount}>{products.length}</span>
                </button>
                {hasFeatured && (
                  <button
                    role="tab"
                    data-category={FEATURED_KEY}
                    aria-selected={tabActive(FEATURED_KEY)}
                    className={`${styles.categoryTab} ${tabActive(FEATURED_KEY) ? styles.categoryTabActive : ''}`}
                    onClick={() => selectCategory(FEATURED_KEY)}
                  >
                    <Star size={13} aria-hidden="true" />
                    Destacados
                    <span className={styles.categoryTabCount}>{products.filter(p => p.isFeatured).length}</span>
                  </button>
                )}
                {categories.map(cat => (
                  <button
                    key={cat}
                    role="tab"
                    data-category={cat}
                    aria-selected={tabActive(cat)}
                    className={`${styles.categoryTab} ${tabActive(cat) ? styles.categoryTabActive : ''}`}
                    onClick={() => handleCatClick(cat)}
                  >
                    {cat}
                    <span className={styles.categoryTabCount}>{categoryCounts.get(cat) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            {catMenuOpen && (
              <>
                <div className={styles.catMenuBackdrop} onClick={() => setCatMenuOpen(false)} aria-hidden="true" />
                <div className={styles.catMenuDropdown} role="menu" aria-label="Menú">
                  <Link
                    href={`/catalogo/${slug}`}
                    role="menuitem"
                    className={styles.catMenuItem}
                    onClick={() => setCatMenuOpen(false)}
                  >
                    Inicio
                  </Link>
                  <Link
                    href={`/catalogo/${slug}/productos`}
                    role="menuitem"
                    className={styles.catMenuItem}
                    onClick={() => setCatMenuOpen(false)}
                  >
                    Catálogo
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className={catalogMode === 'productos' ? styles.catalogLayout : undefined}>
        {/* ── Sidebar de categorías — solo desktop en modo productos ── */}
        {catalogMode === 'productos' && (
          <aside className={styles.catalogSidebar} aria-label="Categorías">
            <p className={styles.catalogSidebarTitle}>
              <Grid size={14} aria-hidden="true" />
              Categorías
            </p>
            <button
              type="button"
              className={`${styles.catalogSidebarItem} ${!activeCategory ? styles.catalogSidebarItemActive : ''}`}
              onClick={() => selectCategory(null)}
            >
              Todos
              <span className={styles.catalogSidebarCount}>{products.length}</span>
            </button>
            {hasFeatured && (
              <button
                type="button"
                className={`${styles.catalogSidebarItem} ${activeCategory === FEATURED_KEY ? styles.catalogSidebarItemActive : ''}`}
                onClick={() => selectCategory(FEATURED_KEY)}
              >
                Destacados
                <span className={styles.catalogSidebarCount}>{products.filter(p => p.isFeatured).length}</span>
              </button>
            )}
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`${styles.catalogSidebarItem} ${activeCategory === cat ? styles.catalogSidebarItemActive : ''}`}
                onClick={() => selectCategory(cat)}
              >
                {cat}
                <span className={styles.catalogSidebarCount}>{categoryCounts.get(cat) ?? 0}</span>
              </button>
            ))}
          </aside>
        )}

      <div className={catalogMode === 'productos' ? styles.catalogContent : undefined}>
      {/* ── Modo catálogo puro — sin hero/shelves, solo título + grid ── */}
      {catalogMode === 'productos' && (
        <div className={styles.catalogPageHeader}>
          <h1 className={styles.catalogPageTitle}>
            Catálogo de Productos
          </h1>
          <p className={styles.catalogPageSubtitle}>
            Todos los productos disponibles
          </p>
          <div className={styles.catalogSearchRow}>
            <div className={styles.catalogSearchWrap}>
              <Search size={16} className={styles.catalogSearchIcon} aria-hidden="true" />
              <input
                type="search"
                className={styles.catalogSearchInput}
                placeholder="Buscar productos..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Buscar productos"
              />
            </div>
          </div>
          <div className={styles.catalogMeta}>
            <button
              type="button"
              className={styles.catalogFiltrosBtn}
              onClick={() => setCatMenuOpen(o => !o)}
              aria-expanded={catMenuOpen}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filtros
            </button>
            <span className={styles.catalogCount}>
              {visible.length} producto{visible.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Hero banner — solo en vista inicial (sin filtro ni búsqueda) ── */}
      {catalogMode === 'home' && browseMode && (() => {
        const covers = heroCovers?.length ? heroCovers : heroCover ? [heroCover] : []
        if (!covers.length) return (
          <section className={styles.heroBanner}>
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>{businessName}</h1>
              {businessDesc && <p className={styles.heroDesc}>{businessDesc}</p>}
            </div>
          </section>
        )
        return (
          <section
            className={`${styles.heroBanner} ${styles.heroBannerClickable}`}
            role="region"
            aria-label="Banner del negocio"
            onClick={() => router.push(`/catalogo/${slug}/productos`)}
          >
            {covers.map((src, idx) => (
              <img
                key={src}
                src={src}
                alt={businessName}
                className={`${styles.heroBannerImg} ${idx === heroIdx ? styles.heroBannerImgActive : styles.heroBannerImgHidden}`}
                aria-hidden={idx !== heroIdx}
              />
            ))}
            <div className={styles.heroOverlay} />
            {covers.length > 1 && (
              <div className={styles.heroDots} aria-hidden="true">
                {covers.map((_, idx) => (
                  <span
                    key={idx}
                    className={`${styles.heroDot} ${idx === heroIdx ? styles.heroDotActive : ''}`}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })()}

      {/* ── Categorías circulares — fila horizontal con scroll ──── */}
      {catalogMode === 'home' && browseMode && categories.length > 0 && (
        <section className={styles.catCircleSection} aria-label="Categorías">
          <div className={styles.catCircleHeader}>
            <span className={styles.catCircleTitle}>
              <LayoutGrid size={16} aria-hidden="true" />
              Explorar Categorías
            </span>
            <button
              type="button"
              className={styles.catCircleVerTodos}
              onClick={() => router.push(`/catalogo/${slug}/productos`)}
            >
              Ver todos →
            </button>
          </div>
          <div className={styles.catCircleTrack}>
            {categories.map(cat => {
              const catImage = categoryImages[cat] ?? null
              const count = categoryCounts.get(cat) ?? 0
              return (
                <button
                  key={cat}
                  type="button"
                  className={styles.catCircleItem}
                  onClick={() => scrollToSection(cat)}
                >
                  <div className={styles.catCircleAvatar}>
                    {catImage ? (
                      <img
                        src={catImage}
                        alt=""
                        className={styles.catCircleImg}
                        loading="lazy"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className={styles.catCircleInitial} aria-hidden="true">
                        {cat.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className={styles.catCircleName}>{cat}</span>
                  <span className={styles.catCircleCount}>{count}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Destacados — showcase de vista inicial ─────────────── */}
      {catalogMode === 'home' && hasFeatured && browseMode && (
        <section className={styles.featuredSection} data-section="featured" aria-label="Productos destacados">
          <div className={styles.featuredHeader}>
            <div className={styles.featuredTitlePill}>
              <Star size={14} aria-hidden="true" />
              Productos Destacados
            </div>
            <button
              type="button"
              className={styles.shelfVerTodos}
              onClick={() => selectCategory(FEATURED_KEY)}
            >
              Ver todos →
            </button>
          </div>
          <div className={styles.featuredGrid}>
            {products.filter(p => p.isFeatured).map(p => (
              <article
                key={p.id}
                className={styles.featuredCard}
                onClick={() => router.push(`/catalogo/${slug}/p/${p.id}`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/catalogo/${slug}/p/${p.id}`) }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalle: ${p.name}`}
              >
                <div className={styles.featuredImageWrap}>
                  {p.image ? (
                    <img src={p.image} alt={p.name} className={styles.featuredImg} loading="lazy" />
                  ) : (
                    <div className={`${styles.featuredPlaceholder} ${styles.gradDefault}`} aria-hidden="true">
                      <span className={styles.productInitial}>{p.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className={styles.featuredInfo}>
                  <span className={styles.featuredName}>{p.name}</span>
                  {p.priceUsd > 0 ? (
                    <div className={styles.featuredPriceBlock}>
                      <span className={styles.featuredPrice}>
                        ${p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {p.priceBs && (
                        <span className={styles.featuredPriceBs}>
                          Bs.&nbsp;{p.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className={styles.priceConsultar}>Consultar precio</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Nuevos Ingresos — productos con badge 'nuevo' ────────── */}
      {catalogMode === 'home' && browseMode && nuevosIngresos.length > 0 && (
        <section className={styles.featuredSection} aria-label="Nuevos ingresos">
          <div className={styles.featuredHeader}>
            <div className={styles.featuredTitlePill}>
              <Sparkles size={14} aria-hidden="true" />
              Nuevos Ingresos
            </div>
          </div>
          <div className={styles.shelfTrack}>
            {nuevosIngresos.map((p, i) => (
              <div key={p.id} className={styles.shelfCard}>
                {renderProductCard(p, i)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Subcategory pills — filtran la categoría en contexto ── */}
      {!searchExpanded && !query && subcategoriesForActive.length > 0 && (
        <div className={styles.subcatScroll}>
          <div className={styles.subcatTrack} role="group" aria-label="Subcategorías">
            <button
              type="button"
              className={`${styles.subcatPill} ${activeSub === null ? styles.subcatPillActive : ''}`}
              onClick={() => { setActiveCategory(null); setActiveSub(null) }}
            >
              Todas
            </button>
            {subcategoriesForActive.map(sub => (
              <button
                key={sub}
                type="button"
                className={`${styles.subcatPill} ${activeSub === sub ? styles.subcatPillActive : ''}`}
                onClick={() => { if (subcatContext) { setActiveCategory(subcatContext); setActiveSub(sub) } }}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Product grid ───────────────────────────────────────── */}
      <main className={styles.productsSection} data-section="products">
        {products.length === 0 ? (
          <div className={styles.empty}>
            <Package className={styles.emptyIcon} size={52} strokeWidth={1.25} aria-hidden="true" />
            <h2 className={styles.emptyTitle}>Catálogo en construcción</h2>
            <p className={styles.emptySubtitle}>Este negocio está preparando su vitrina digital.</p>
          </div>
        ) : (browseMode && catalogMode === 'home') ? (
          // Shelves horizontales por categoría — scroll-spy vía catSectionRefs
          sections.map(section => (
            <section
              key={section.key}
              className={styles.catSection}
              data-cat-key={section.key}
              ref={el => {
                if (el) catSectionRefs.current.set(section.key, el)
                else catSectionRefs.current.delete(section.key)
              }}
              aria-label={section.name}
            >
              {/* Header del shelf */}
              <div
                className={styles.shelfHeader}
                style={section.color
                  ? ({ '--section-accent': section.color } as CSSProperties)
                  : undefined}
              >
                <h2 className={styles.shelfTitle}>
                  <span className={styles.shelfTitleAccent} aria-hidden="true" />
                  {section.name}
                  <span className={styles.shelfCount}>{section.items.length}</span>
                </h2>
                <button
                  type="button"
                  className={styles.shelfVerTodos}
                  onClick={() => router.push(
                    section.key === '__otros__'
                      ? `/catalogo/${slug}/productos`
                      : `/catalogo/${slug}/productos?categoria=${encodeURIComponent(section.key)}`
                  )}
                  aria-label={`Ver todos los productos de ${section.name}`}
                >
                  Ver todos →
                </button>
              </div>

              {/* Track horizontal */}
              <div className={styles.shelfTrack} role="list" aria-label={`Productos de ${section.name}`}>
                {section.items.map((p, i) => (
                  <div key={p.id} className={styles.shelfCard} role="listitem">
                    {renderProductCard(p, i, section.color)}
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            {query ? (
              <>
                <Search className={styles.emptyIcon} size={40} strokeWidth={1.25} aria-hidden="true" />
                <p className={styles.emptyTitle}>Sin resultados para &ldquo;{query}&rdquo;</p>
                <p className={styles.emptySubtitle}>Intenta con otro nombre o categoría.</p>
              </>
            ) : (
              <p className={styles.emptyTitle}>Sin productos en esta categoría</p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.productsGrid} key={`${activeCategory ?? 'all'}|${activeSub ?? ''}`}>
              {paged.map((p, i) => renderProductCard(p, i))}
            </div>
            {remaining > 0 && (
              <div className={styles.loadMoreWrap}>
                <button
                  type="button"
                  className={styles.loadMoreBtn}
                  onClick={() => setVisibleCount(v => v + 10)}
                >
                  <span>Ver 10 más</span>
                  <span className={styles.loadMoreCount}>{remaining} restantes</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
      </div>
      </div>

      {/* ── Volver al inicio ────────────────────────────────────── */}
      {!cartOpen && !selectedProduct && !checkoutOpen && (
        <button
          type="button"
          className={`${styles.backTopBtn} ${showBackTop ? styles.backTopBtnVisible : ''} ${cart.length > 0 && businessPhone ? styles.backTopBtnStacked : ''}`}
          onClick={scrollToTop}
          aria-label="Volver al inicio"
          aria-hidden={!showBackTop}
          tabIndex={showBackTop ? 0 : -1}
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}

      <CartDrawer slug={slug} rate={rate} paymentMethods={paymentMethods} />

      {/* ── Product detail modal (bottom sheet) ────────────────── */}
      {selP && (
        <>
          <div
            className={styles.modalOverlay}
            aria-hidden="true"
            onClick={closeModal}
          />
          <div
            className={styles.modalSheet}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle: ${selP.name}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle (mobile only) */}
            <div className={styles.modalHandle} aria-hidden="true" />

            {/* Image */}
            <div className={styles.modalImageWrap}>
              {selP.image ? (
                <img
                  src={selP.images[modalImageIndex] ?? selP.image}
                  alt={selP.name}
                  className={styles.modalImage}
                />
              ) : (
                <div
                  className={`${styles.modalImagePlaceholder} ${styles.gradDefault}`}
                  aria-hidden="true"
                >
                  <span className={styles.modalInitial}>
                    {selP.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <button
                ref={closeRef}
                type="button"
                className={styles.modalClose}
                onClick={closeModal}
                aria-label="Cerrar"
              >
                <X size={16} aria-hidden="true" />
              </button>

              {/* Status badge on modal image */}
              {selP.availability === 'discontinued' && (
                <div className={styles.badgeDiscontinued} aria-label="Descontinuado">
                  <span><Archive size={10} aria-hidden="true" />&nbsp;Descontinuado</span>
                </div>
              )}
              {selP.catalogVisibility === 'on_request' && selP.availability !== 'discontinued' && (
                <div className={styles.badgeOnRequest}>Consultar</div>
              )}
              {(selP.outOfStock || selP.availability === 'out_of_stock') &&
                selP.availability !== 'discontinued' && selP.catalogVisibility !== 'on_request' && (
                <span className={styles.badgeSinStock}>Sin stock</span>
              )}
              {selP.availability === 'low_stock' && !selP.outOfStock && selP.catalogVisibility !== 'on_request' && (
                <span className={styles.badgeLowStock}>Pocas unidades</span>
              )}
            </div>

            {/* Galería de miniaturas — solo si hay más de una imagen */}
            {selP.images.length > 1 && (
              <div className={styles.modalThumbs} role="group" aria-label="Imágenes del producto">
                {selP.images.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    className={`${styles.modalThumb} ${idx === modalImageIndex ? styles.modalThumbActive : ''}`}
                    onClick={() => setModalImageIndex(idx)}
                    aria-label={`Ver imagen ${idx + 1}`}
                    aria-pressed={idx === modalImageIndex}
                  >
                    <img src={src} alt="" loading="lazy" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable body */}
            <div className={styles.modalBody}>
              {selP.categoryName && (
                <span
                  className={styles.categoryBadge}
                  style={{ '--badge-color': categoryColors[selP.categoryName] ?? undefined } as CSSProperties}
                >
                  {selP.categoryName}
                </span>
              )}
              <h2 className={styles.modalTitle}>{selP.name}</h2>
              {selP.description && (
                <p className={styles.modalDesc}>{selP.description}</p>
              )}

              <div className={styles.modalPrice}>
                {selP.availability === 'discontinued' ? (
                  <span className={styles.priceDiscontinued}>No disponible</span>
                ) : selP.catalogVisibility === 'on_request' ? (
                  <span className={styles.modalPriceConsultar}>Consultar precio</span>
                ) : selP.priceUsd > 0 ? (
                  <>
                    <span className={styles.modalPriceSymbol}>$</span>
                    <span className={styles.modalPriceNumber}>
                      {selP.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    {selP.priceBs && (
                      <span className={styles.modalPriceBs}>
                        Bs.&nbsp;{selP.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.modalPriceConsultar}>Consultar precio</span>
                )}
              </div>

              {/* Variant selector */}
              {selP.variants.length > 0 &&
                selP.availability !== 'discontinued' &&
                selP.catalogVisibility !== 'on_request' && (
                <div className={styles.variantSection}>
                  {isCombinedVariant ? (
                    <>
                      <div className={styles.variantGroup}>
                        <span className={styles.variantGroupLabel}>{capitalize(combinedDim1Label)}</span>
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
                          <span className={styles.variantGroupLabel}>{capitalize(combinedDim2Label)}</span>
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
                                  {soldOut && <span className={styles.variantSoldOutLabel}>Agotado</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // ponytail: bug conocido sin resolver -- selectedVariantId es unico y
                    // compartido entre TODOS los grupos aqui, asi que un producto con 2+
                    // tipos sin combination_key (ej. "talla" y "color" como filas separadas,
                    // no combinadas) puede "pisar" un grupo con el otro al elegir. Mismo bug
                    // que se corrigio en ProductoDetalle.tsx para el modelo combinado -- este
                    // es el modelo legacy sin combination_key. Auditoria 18 jul confirmo
                    // impacto real: 1 solo producto en toda la DB con 2+ tipos aqui ("Camisa
                    // Polo", business_id=1 "Mi Negocio Demo" -- dato de prueba, no tenant
                    // real). No se corrige por bajo impacto; subir de prioridad si aparece un
                    // producto real de un tenant con este modelo de datos.
                    variantGroups.map(g => (
                      <div key={g.tipo} className={styles.variantGroup}>
                        <span className={styles.variantGroupLabel}>{capitalize(g.tipo)}</span>
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
                                {soldOut && <span className={styles.variantSoldOutLabel}>Agotado</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                  {variantError && <p className={styles.variantErrorMsg}>Selecciona una opción</p>}
                </div>
              )}

              {/* Qty stepper (only for purchasable products) */}
              {selP.availability !== 'discontinued' &&
                selP.catalogVisibility !== 'on_request' &&
                selP.priceUsd > 0 && (
                <>
                  <div className={styles.modalQtyRow}>
                    <span className={styles.modalQtyLabel}>Cantidad</span>
                    <div className={styles.qtyControl}>
                      <button
                        type="button"
                        className={styles.qtyControlBtn}
                        onClick={() => setModalQty(q => Math.max(1, q - 1))}
                        disabled={modalQty <= 1}
                        aria-label="Reducir cantidad"
                      >
                        <Minus size={14} />
                      </button>
                      <span className={styles.qtyValue}>{modalQty}</span>
                      <button
                        type="button"
                        className={styles.qtyControlBtn}
                        onClick={() => setModalQty(q => Math.min(availableStock, q + 1))}
                        disabled={modalQty >= availableStock}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  {availableStock > 0 && availableStock <= 10 && (
                    <span className={styles.modalQtyAvailable}>
                      {availableStock} disponible{availableStock === 1 ? '' : 's'}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Always-visible footer CTA */}
            <div className={styles.modalFooter}>
              {selP.availability === 'discontinued' ? (
                <div className={styles.btnDisabled} aria-disabled="true">No disponible</div>
              ) : selP.catalogVisibility === 'on_request' ? (
                <a
                  href={getConsultarWaUrl(businessPhone, selP.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnWhatsapp}
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  Consultar disponibilidad
                </a>
              ) : selP.outOfStock || selP.availability === 'out_of_stock' ? (
                <div className={styles.btnDisabled} aria-disabled="true">Sin stock</div>
              ) : selP.priceUsd > 0 ? (
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.btnAddCart}
                    onClick={() => {
                      if (selP.variants.length > 0 && !selectedVariant) { setVariantError(true); return }
                      addToCart(selP, modalQty, selectedVariant ?? undefined)
                      closeModal(); setCartOpen(true)
                    }}
                  >
                    <ShoppingBag size={17} aria-hidden="true" />
                    Agregar · ${((selP.priceUsd + (selectedVariant?.precio_extra ?? 0)) * modalQty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </button>
                </div>
              ) : (
                <a
                  href={getConsultarWaUrl(businessPhone, selP.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnWhatsapp}
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  Consultar precio
                </a>
              )}
              <button
                type="button"
                className={styles.modalShareBtn}
                onClick={() => {
                  navigator.share?.({ title: selP.name, url: window.location.href }).catch(() => {})
                }}
                aria-label={`Compartir ${selP.name}`}
              >
                <Share2 size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Panel de información del negocio ────────────────────── */}
      {infoOpen && (
        <div className={styles.infoOverlay} onClick={() => setInfoOpen(false)}>
          <div
            className={styles.infoPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Información del negocio"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.infoPanelClose}
              onClick={() => setInfoOpen(false)}
              aria-label="Cerrar información"
            >
              <X size={18} aria-hidden="true" />
            </button>

            {/* Header del negocio */}
            <div className={styles.infoBizHeader}>
              {businessLogo ? (
                <img src={businessLogo} alt={businessName} className={styles.infoBizLogo} />
              ) : (
                <div className={styles.infoBizInitials} aria-hidden="true">{initials}</div>
              )}
              <div>
                <h2 className={styles.infoBizName}>{businessName}</h2>
                {businessDesc && <p className={styles.infoBizDesc}>{businessDesc}</p>}
                {businessCity && <p className={styles.infoBizCity}>{businessCity}</p>}
              </div>
            </div>

            {/* Métodos de pago */}
            {paymentMethods.length > 0 && (
              <div className={styles.infoSection}>
                <p className={styles.infoSectionLabel}>Métodos de pago</p>
                <div className={styles.infoPayMethods}>
                  {paymentMethods.map(m => (
                    <span key={m.id} className={styles.infoPayPill}>{m.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Contáctanos */}
            {(businessPhone || businessInstagram) && (
              <div className={styles.infoSection}>
                <p className={styles.infoSectionLabel}>Contáctanos</p>
                <div className={styles.infoContacts}>
                  {businessPhone && (
                    <a
                      href={`https://wa.me/${businessPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.infoContactBtn}
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
                      className={styles.infoContactBtn}
                      style={{ '--btn-color': '#E1306C' } as CSSProperties}
                    >
                      <AtSign size={18} aria-hidden="true" />
                      <span>Instagram</span>
                    </a>
                  )}
                  {businessPhone && (
                    <a
                      href={`tel:+${businessPhone}`}
                      className={styles.infoContactBtn}
                      style={{ '--btn-color': 'var(--biz-color)' } as CSSProperties}
                    >
                      <Phone size={18} aria-hidden="true" />
                      <span>Llamar</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Horario */}
            {businessHours && (
              <div className={styles.infoSection}>
                <p className={styles.infoSectionLabel}>Horario de atención</p>
                <p className={styles.infoHours}>{businessHours}</p>
              </div>
            )}

            {/* Compartir */}
            <button
              type="button"
              className={styles.infoShareBtn}
              onClick={() => {
                navigator.share?.({ title: businessName, url: window.location.href })
                  .catch(() => {})
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              Compartir catálogo
            </button>
          </div>
        </div>
      )}

      {/* ── WhatsApp FAB — solo visible con items en carrito, oculto con overlays abiertos ── */}
      {cart.length > 0 && businessPhone && !selectedProduct && !cartOpen && !checkoutOpen && (
        <a
          href={`https://wa.me/${businessPhone}?text=${encodeURIComponent('Hola, vi tu catálogo en ActivoPOS y me interesa pedir.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waFab}
          aria-label="Contactar por WhatsApp"
        >
          <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
          <span className={styles.waFabText}>Pedir por WhatsApp</span>
        </a>
      )}
    </>
  )
}
