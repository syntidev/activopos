'use client'

import { useState, useMemo, useRef, useEffect, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Package, X, MessageCircle, ShoppingBag, Plus, Minus, Search,
  CheckCircle, Star, Archive, Menu, Flame, Sparkles, Tag, ThumbsUp,
  Info, AtSign, Phone, Share2, ArrowUp,
} from 'lucide-react'
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

interface CartItem {
  product_id:     number
  name:           string
  qty:            number
  price_usd:      number
  image_url:      string | null
  variant_id?:    number
  variant_label?: string
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface DeliveryZone {
  nombre: string
  precio: number
}

interface DeliveryInfo {
  enabled:     boolean
  fee_default?: number
  zones?:      DeliveryZone[]
}

interface Props {
  products:       CatalogProduct[]
  categories:     string[]
  categoryColors: Record<string, string | null>
  slug:           string
  rate:           number
  paymentMethods: PaymentMethod[]
  businessPhone:  string
  businessName:   string
  businessLogo:   string | null
  businessCity:   string | null
  businessDesc:   string | null
  heroCover?:     string | null
  businessHours:     string | null
  businessInstagram: string | null
}

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Validación simple de celular venezolano: acepta 0412…, 412…, 58412…
function isValidVePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return /^(?:58|0)?(412|414|416|422|424|426)\d{7}$/.test(digits)
}

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

// EXCEPCIÓN DOCUMENTADA — Sprint 35.1
// Colores de confeti para animación de celebración post-pedido.
// Uso puramente decorativo/animación — no UI funcional ni semántico.
// Sin brand de ActivoPOS (#0038BD prohibido en catálogo) — paleta genérica.
const CONFETTI_COLORS = ['#3B82F6','#FF6B35','#FFD700','#10B981','#F472B6','#8B5CF6','#EF4444','#06B6D4']

/* ── Component ───────────────────────────────────────────────── */

export function CatalogoGrid({
  products,
  categories,
  categoryColors,
  slug,
  rate,
  paymentMethods,
  businessPhone,
  businessName,
  businessLogo,
  businessCity,
  businessDesc,
  heroCover,
  businessHours,
  businessInstagram,
}: Props) {

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSub,      setActiveSub]      = useState<string | null>(null)
  const [query,          setQuery]          = useState('')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [modalQty,       setModalQty]       = useState(1)
  const [cart,           setCart]           = useState<CartItem[]>([])
  const [cartOpen,       setCartOpen]       = useState(false)
  const [checkoutOpen,   setCheckoutOpen]   = useState(false)
  const [cName,          setCName]          = useState('')
  const [cPhone,         setCPhone]         = useState('')
  const [phoneError,     setPhoneError]     = useState(false)
  const [cRef,           setCRef]           = useState('')
  const [cPayment,       setCPayment]       = useState(paymentMethods[0]?.name ?? '')
  const [delivery,       setDelivery]       = useState<DeliveryInfo | null>(null)
  const [zoneIdx,        setZoneIdx]        = useState(-1)
  const [zoneAddress,    setZoneAddress]    = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitted,      setSubmitted]      = useState(false)
  const [catMenuOpen,    setCatMenuOpen]    = useState(false)
  const [cartBumping,    setCartBumping]    = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [infoOpen,       setInfoOpen]       = useState(false)
  const [visibleCount,   setVisibleCount]   = useState(10)
  const [spyCategory,    setSpyCategory]    = useState<string | null>(null)
  const [sectionCounts,  setSectionCounts]  = useState<Record<string, number>>({})
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [variantError,    setVariantError]    = useState(false)
  const [selectedDim1,    setSelectedDim1]    = useState<string | null>(null)
  const [showBackTop,    setShowBackTop]    = useState(false)

  const closeRef  = useRef<HTMLButtonElement>(null)
  const nameRef   = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const categoryTrackRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  // El scroll vive en `.root` (page.tsx), no en window. El header es hijo directo
  // de `.root`, así que su parentElement es el contenedor scrolleable.
  const getScroller = (): HTMLElement | null => headerRef.current?.parentElement ?? null

  const scrollToTop = () => {
    getScroller()?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToProducts = () => {
    const scroller = getScroller()
    const target = scroller?.querySelector<HTMLElement>('[data-section="products"]')
    if (scroller && target) {
      const top = target.offsetTop - 116 // debajo del header sticky (≈112px)
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
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

  const confettiParticles = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      style: {
        left:              `${(i * 1.7 % 10) * 10}%`,
        animationDelay:    `${(i * 0.13) % 2.5}s`,
        animationDuration: `${2 + (i * 0.19) % 2}s`,
        background:        CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width:             `${8 + (i % 6)}px`,
        height:            `${8 + (i % 4)}px`,
        borderRadius:      i % 3 === 0 ? '50%' : '3px',
      },
    }))
  , [])

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
          if (key) setSpyCategory(key === ORPHAN_KEY ? null : key)
        }
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.15, 0.4] },
    )
    Array.from(catSectionRefs.current.values()).forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [browseMode, sections])

  // Cart computed
  const totalItems  = cart.reduce((acc, i) => acc + i.qty, 0)
  const subtotalUsd = cart.reduce((acc, i) => acc + i.qty * i.price_usd, 0)
  const subtotalBs  = subtotalUsd * rate

  const addToCart = (product: CatalogProduct, qty: number, variant?: CatalogProductVariant) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id && i.variant_id === variant?.id)
      if (existing) {
        return prev.map(i =>
          (i.product_id === product.id && i.variant_id === variant?.id) ? { ...i, qty: i.qty + qty } : i,
        )
      }
      return [...prev, {
        product_id:    product.id,
        name:          product.name,
        qty,
        price_usd:     product.priceUsd + (variant?.precio_extra ?? 0),
        image_url:     product.image,
        variant_id:    variant?.id,
        variant_label: variant ? `${capitalize(variant.tipo)}: ${variant.valor}` : undefined,
      }]
    })
    setCartBumping(true)
    setTimeout(() => setCartBumping(false), 300)
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

  const updateCartQty = (productId: number, variantId: number | undefined, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId && i.variant_id === variantId)
      if (!item) return prev
      const newQty = item.qty + delta
      if (newQty <= 0) return prev.filter(i => !(i.product_id === productId && i.variant_id === variantId))
      return prev.map(i => (i.product_id === productId && i.variant_id === variantId) ? { ...i, qty: newQty } : i)
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

  // Scroll lock
  useEffect(() => {
    const locked = !!selectedProduct || cartOpen || checkoutOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedProduct, cartOpen, checkoutOpen])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (catMenuOpen)                { setCatMenuOpen(false); return }
      if (searchExpanded)             { setSearchExpanded(false); setQuery(''); return }
      if (checkoutOpen && !submitting) { setCheckoutOpen(false); return }
      if (selectedProduct)            { closeModal(); return }
      if (cartOpen)                   { setCartOpen(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [checkoutOpen, selectedProduct, cartOpen, submitting, catMenuOpen, searchExpanded])

  // Focus traps
  useEffect(() => {
    if (!selectedProduct) return
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [selectedProduct])

  useEffect(() => {
    if (!checkoutOpen) return
    const t = setTimeout(() => nameRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [checkoutOpen])

  // Zona de delivery — se consulta cada vez que se abre "Antes de enviar"
  useEffect(() => {
    if (!checkoutOpen) return
    fetch(`/api/public/delivery/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then((j: DeliveryInfo | null) => { if (j) setDelivery(j) })
      .catch(() => {})
  }, [checkoutOpen, slug])

  const hasZones     = !!delivery?.enabled && (delivery.zones?.length ?? 0) > 0
  const hasFreeZone  = !!delivery?.enabled && (delivery.zones?.length ?? 0) === 0
  const deliveryCost = hasZones
    ? (zoneIdx >= 0 ? delivery!.zones![zoneIdx].precio : 0)
    : hasFreeZone
      ? (delivery!.fee_default ?? 0)
      : 0
  const checkoutTotalUsd = subtotalUsd + deliveryCost

  const handleCheckout = async () => {
    if (!cName.trim() || !cPhone.trim() || !cPayment.trim() || cart.length === 0) return
    if (!isValidVePhone(cPhone)) { setPhoneError(true); return }
    if (hasZones && zoneIdx < 0) return
    setSubmitting(true)
    try {
      const baseRef = cRef.trim() || 'Sin especificar'
      const referenceWithZone = hasZones
        ? `${baseRef} · Zona: ${delivery!.zones![zoneIdx].nombre} · Costo delivery: ${fmtUsd(delivery!.zones![zoneIdx].precio)}`
        : hasFreeZone
          ? `${baseRef}${zoneAddress.trim() ? ` · Dirección: ${zoneAddress.trim()}` : ''} · Costo delivery: ${fmtUsd(delivery!.fee_default ?? 0)}`
          : baseRef

      const res = await fetch(`/api/catalog/${slug}/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items:              cart.map(i => ({ product_id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
          customer_name:      cName.trim(),
          customer_phone:     cPhone.trim(),
          customer_reference: referenceWithZone,
          payment_method:     cPayment,
        }),
      })

      if (res.ok) {
        const data = await res.json() as { whatsapp_url: string | null }
        setSubmitted(true)
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer')
        }
        setCart([])
        setTimeout(() => {
          setSubmitted(false)
          setCheckoutOpen(false)
          setCartOpen(false)
          setCName(''); setCPhone(''); setCRef('')
          setCPayment(paymentMethods[0]?.name ?? '')
          setZoneIdx(-1); setZoneAddress('')
        }, 3000)
      }
    } catch { /* user stays in form */ }
    finally { setSubmitting(false) }
  }

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

  // Variantes combinadas (talla+color…): combination_key = "S-Azul", tipo = "talla+color".
  const isCombinedVariant = !!selP?.variants.some(v => v.combination_key)
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
        onClick={() => openModal(p)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(p) }
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

          <div className={styles.productPriceRow}>
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
            {p.catalogVisibility !== 'on_request' &&
              p.availability !== 'discontinued' &&
              !p.outOfStock &&
              p.availability !== 'out_of_stock' &&
              p.priceUsd > 0 && (
              <button
                type="button"
                className={styles.addBtnCircle}
                onClick={e => { e.stopPropagation(); p.variants.length > 0 ? openModal(p) : addToCart(p, 1) }}
                aria-label={p.variants.length > 0 ? `Ver opciones de ${p.name}` : `Agregar ${p.name} al carrito`}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header ref={headerRef} className={styles.stickyHeader}>
        <div className={styles.headerLogo}>
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
        </div>

        <button
          type="button"
          className={styles.infoBtn}
          onClick={() => setInfoOpen(true)}
          aria-label="Información del negocio"
        >
          <Info size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`${styles.stickyCartBtn} ${totalItems === 0 ? styles.cartIdleAnimation : ''}`}
          onClick={() => setCartOpen(true)}
          aria-label={`Carrito — ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`}
        >
          <ShoppingBag size={20} aria-hidden="true" />
          {totalItems > 0 && (
            <span className={`${styles.cartCount} ${cartBumping ? styles.cartBadgeBump : ''}`} aria-hidden="true">
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
        </button>
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

            <div ref={categoryTrackRef} className={styles.categoryTrack} role="tablist" aria-label="Filtrar por categoría">
              <button
                role="tab"
                aria-selected={tabActive(null)}
                className={`${styles.categoryTab} ${tabActive(null) ? styles.categoryTabActive : ''}`}
                onClick={() => scrollToSection(null)}
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
                  onClick={() => scrollToSection(cat)}
                >
                  {cat}
                  <span className={styles.categoryTabCount}>{categoryCounts.get(cat) ?? 0}</span>
                </button>
              ))}
            </div>

            {catMenuOpen && (
              <>
                <div className={styles.catMenuBackdrop} onClick={() => setCatMenuOpen(false)} aria-hidden="true" />
                <div className={styles.catMenuDropdown} role="menu" aria-label="Todas las categorías">
                  <p className={styles.catMenuTitle}>Categorías</p>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.catMenuItem}
                    onClick={() => { scrollToSection(null); setCatMenuOpen(false) }}
                  >
                    Todos
                    <span className={styles.catMenuCount}>{products.length}</span>
                  </button>
                  {hasFeatured && (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.catMenuItem}
                      onClick={() => { selectCategory(FEATURED_KEY); setCatMenuOpen(false) }}
                    >
                      Destacados
                      <span className={styles.catMenuCount}>{products.filter(p => p.isFeatured).length}</span>
                    </button>
                  )}
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      role="menuitem"
                      className={styles.catMenuItem}
                      onClick={() => { scrollToSection(cat); setCatMenuOpen(false) }}
                    >
                      {cat}
                      <span className={styles.catMenuCount}>{categoryCounts.get(cat) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Hero banner — solo en vista inicial (sin filtro ni búsqueda) ── */}
      {browseMode && (
        <section className={styles.heroBanner} aria-label="Presentación del negocio">
          {heroCover && (
            <img src={heroCover} alt={businessName} className={styles.heroBannerImg} />
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{businessName}</h1>
            {businessDesc && (
              <p className={styles.heroDesc}>{businessDesc}</p>
            )}
            <button
              type="button"
              className={styles.heroCtaBtn}
              onClick={scrollToProducts}
            >
              Ver productos
            </button>
          </div>
        </section>
      )}

      {/* ── Category showcase — hasta 4 tiles (clamp anti-desbordamiento) ── */}
      {browseMode && categories.length > 0 && (
        <section className={styles.catShowcase} aria-label="Categorías">
          <div className={styles.catShowcaseGrid}>
            {categories.slice(0, 4).map(cat => {
              const first = products.find(p => p.categoryName === cat && p.image)
              const count = categoryCounts.get(cat) ?? 0
              return (
                <button
                  key={cat}
                  type="button"
                  className={styles.catTile}
                  onClick={() => scrollToSection(cat)}
                  style={categoryColors[cat] ? ({ '--tile-accent': categoryColors[cat] } as CSSProperties) : undefined}
                >
                  {first?.image ? (
                    <img src={first.image} alt="" className={styles.catTileImg} loading="lazy" aria-hidden="true" />
                  ) : (
                    <div className={`${styles.catTilePlaceholder} ${styles.gradDefault}`} aria-hidden="true" />
                  )}
                  <div className={styles.catTileOverlay} />
                  <div className={styles.catTileInfo}>
                    <span className={styles.catTileName}>{cat}</span>
                    <span className={styles.catTileCount}>{count} producto{count !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Destacados — showcase de vista inicial ─────────────── */}
      {hasFeatured && browseMode && (
        <section className={styles.featuredSection} data-section="featured" aria-label="Productos destacados">
          <div className={styles.featuredHeader}>
            <Star size={16} aria-hidden="true" />
            <span className={styles.featuredTitle}>Destacados</span>
          </div>
          <div className={styles.featuredGrid}>
            {products.filter(p => p.isFeatured).map(p => (
              <article
                key={p.id}
                className={styles.featuredCard}
                onClick={() => openModal(p)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(p) }
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
        ) : browseMode ? (
          // Vitrina apilada por categoría — paginación independiente por sección
          sections.map(section => {
            const limit = sectionCounts[section.key] ?? 10
            const shown = section.items.slice(0, limit)
            const left  = section.items.length - limit
            return (
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
                <h2
                  className={styles.catSectionTitle}
                  style={section.color ? ({ '--section-accent': section.color } as CSSProperties) : undefined}
                >
                  {section.name}
                  <span className={styles.catSectionCount}>{section.items.length}</span>
                </h2>
                <div className={styles.productsGrid}>
                  {shown.map((p, i) => renderProductCard(p, i, section.color))}
                </div>
                {left > 0 && (
                  <div className={styles.loadMoreWrap}>
                    <button
                      type="button"
                      className={styles.loadMoreBtn}
                      onClick={() => setSectionCounts(s => ({ ...s, [section.key]: (s[section.key] ?? 10) + 10 }))}
                    >
                      <span>Ver 10 más</span>
                      <span className={styles.loadMoreCount}>{left} restantes</span>
                    </button>
                  </div>
                )}
              </section>
            )
          })
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

      {/* ── Volver al inicio ────────────────────────────────────── */}
      <button
        type="button"
        className={`${styles.backTopBtn} ${showBackTop ? styles.backTopBtnVisible : ''}`}
        onClick={scrollToTop}
        aria-label="Volver al inicio"
        aria-hidden={!showBackTop}
        tabIndex={showBackTop ? 0 : -1}
      >
        <ArrowUp size={20} aria-hidden="true" />
      </button>

      {/* ── Cart drawer backdrop ────────────────────────────────── */}
      {cartOpen && (
        <div
          className={styles.drawerBackdrop}
          aria-hidden="true"
          onClick={() => { if (!checkoutOpen) setCartOpen(false) }}
        />
      )}

      {/* ── Cart drawer ─────────────────────────────────────────── */}
      {cartOpen && (
        <div className={styles.drawer} role="dialog" aria-modal="true" aria-label="Mi Pedido">
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleGroup}>
              <h2 className={styles.drawerTitle}>Mi Pedido</h2>
              <span className={styles.drawerSubtitle}>Shopping Bag</span>
            </div>
            <button
              type="button"
              className={styles.drawerClose}
              onClick={() => setCartOpen(false)}
              aria-label="Cerrar carrito"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.drawerItems}>
            {cart.length === 0 ? (
              <div className={styles.drawerEmpty}>
                <ShoppingBag size={40} strokeWidth={1.25} aria-hidden="true" />
                <p className={styles.drawerEmptyText}>
                  Tu carrito está vacío.<br />Agrega productos para ordenar.
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div key={`${item.product_id}-${item.variant_id ?? 'base'}`} className={styles.drawerItem}>
                  <div className={styles.drawerItemThumb}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className={`${styles.drawerItemThumbFallback} ${styles.gradDefault}`}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.drawerItemInfo}>
                    <span className={styles.drawerItemName}>{item.name}</span>
                    {item.variant_label && (
                      <span className={styles.drawerItemVariant}>{item.variant_label}</span>
                    )}
                    <span className={styles.drawerItemPrice}>{fmtUsd(item.price_usd)} c/u</span>
                    <span className={styles.drawerItemPriceBs}>{fmtBs(item.price_usd * rate)} c/u</span>
                    <span className={styles.drawerItemSubtotal}>{fmtUsd(item.qty * item.price_usd)}</span>
                  </div>
                  <div className={styles.drawerQtyCtrl}>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, item.variant_id, -1)}
                      aria-label={`Reducir cantidad de ${item.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className={styles.drawerQtyNum}>{item.qty}</span>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, item.variant_id, 1)}
                      aria-label={`Aumentar cantidad de ${item.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className={styles.drawerFooter}>
              <div className={styles.drawerTotals}>
                <div className={styles.drawerTotalRow}>
                  <span className={styles.drawerTotalLabel}>Subtotal</span>
                  <span className={styles.drawerTotalUsd}>{fmtUsd(subtotalUsd)}</span>
                </div>
                <div className={styles.drawerTotalRow}>
                  <span className={styles.drawerTotalLabel}>Equivalente Bs.</span>
                  <span className={styles.drawerTotalBs}>{fmtBs(subtotalBs)}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.drawerWaBtn}
                onClick={() => setCheckoutOpen(true)}
              >
                <MessageCircle size={18} aria-hidden="true" />
                Finalizar por WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Checkout modal ──────────────────────────────────────── */}
      {checkoutOpen && !submitted && (
        <div
          className={styles.checkoutOverlay}
          onClick={e => { if (e.target === e.currentTarget && !submitting) setCheckoutOpen(false) }}
        >
          <div className={styles.checkoutModal} role="dialog" aria-modal="true" aria-label="Antes de enviar">
            <div className={styles.checkoutHeader}>
              <h3 className={styles.checkoutTitle}>Antes de enviar</h3>
              <p className={styles.checkoutSubtitle}>
                Déjanos tus datos para personalizar tu pedido.
              </p>
            </div>
            <div className={styles.checkoutFields}>
              <div className={styles.checkoutFieldGroup}>
                <label className={styles.checkoutLabel} htmlFor="co-name">
                  Nombre <span className={styles.checkoutRequired}>*</span>
                </label>
                <input
                  ref={nameRef}
                  id="co-name"
                  type="text"
                  className={styles.checkoutInput}
                  value={cName}
                  onChange={e => setCName(e.target.value)}
                  placeholder="Tu nombre completo"
                  disabled={submitting}
                />
              </div>
              <div className={styles.checkoutFieldGroup}>
                <label className={styles.checkoutLabel} htmlFor="co-phone">
                  WhatsApp <span className={styles.checkoutRequired}>*</span>
                </label>
                <input
                  id="co-phone"
                  type="tel"
                  className={`${styles.checkoutInput} ${phoneError ? styles.checkoutInputError : ''}`}
                  value={cPhone}
                  onChange={e => { setCPhone(e.target.value); if (phoneError) setPhoneError(false) }}
                  placeholder="0412XXXXXXX"
                  aria-invalid={phoneError}
                  disabled={submitting}
                />
                {phoneError && (
                  <span className={styles.checkoutFieldError}>
                    Número inválido. Usa un celular venezolano (0412, 0414, 0416, 0424, 0426).
                  </span>
                )}
              </div>
              <div className={styles.checkoutFieldGroup}>
                <label className={styles.checkoutLabel} htmlFor="co-ref">
                  Referencia / Sector <span className={styles.checkoutOptional}>(opcional)</span>
                </label>
                <input
                  id="co-ref"
                  type="text"
                  className={styles.checkoutInput}
                  value={cRef}
                  onChange={e => setCRef(e.target.value)}
                  placeholder="Ej: El Paraíso, piso 2"
                  disabled={submitting}
                />
              </div>
              {paymentMethods.length > 0 && (
                <div className={styles.checkoutFieldGroup}>
                  <label className={styles.checkoutLabel} htmlFor="co-payment">
                    Método de pago <span className={styles.checkoutRequired}>*</span>
                  </label>
                  <select
                    id="co-payment"
                    className={styles.checkoutSelect}
                    value={cPayment}
                    onChange={e => setCPayment(e.target.value)}
                    disabled={submitting}
                  >
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.name}>{pm.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {hasZones && (
                <div className={styles.checkoutFieldGroup}>
                  <label className={styles.checkoutLabel} htmlFor="co-zone">
                    Zona de entrega <span className={styles.checkoutRequired}>*</span>
                  </label>
                  <select
                    id="co-zone"
                    className={styles.checkoutSelect}
                    value={zoneIdx}
                    onChange={e => setZoneIdx(Number(e.target.value))}
                    disabled={submitting}
                  >
                    <option value={-1} disabled>Selecciona tu zona…</option>
                    {delivery!.zones!.map((z, i) => (
                      <option key={z.nombre} value={i}>{z.nombre} — {fmtUsd(z.precio)}</option>
                    ))}
                  </select>
                </div>
              )}

              {hasFreeZone && (
                <div className={styles.checkoutFieldGroup}>
                  <label className={styles.checkoutLabel} htmlFor="co-zone-address">
                    Dirección de entrega
                  </label>
                  <input
                    id="co-zone-address"
                    type="text"
                    className={styles.checkoutInput}
                    value={zoneAddress}
                    onChange={e => setZoneAddress(e.target.value)}
                    placeholder="Calle, casa/edificio, referencia"
                    disabled={submitting}
                  />
                </div>
              )}

              {(hasZones || hasFreeZone) && (
                <div className={styles.checkoutTotalRow}>
                  <span className={styles.checkoutTotalLabel}>Total con delivery</span>
                  <span className={styles.checkoutTotalValue}>{fmtUsd(checkoutTotalUsd)}</span>
                </div>
              )}
            </div>
            <div className={styles.checkoutActions}>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleCheckout}
                disabled={
                  submitting || !cName.trim() || !cPhone.trim() ||
                  (paymentMethods.length > 0 && !cPayment) ||
                  (hasZones && zoneIdx < 0)
                }
              >
                <MessageCircle size={18} aria-hidden="true" />
                {submitting ? 'Enviando…' : 'Enviar por WhatsApp'}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setCheckoutOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Celebration overlay ─────────────────────────────────── */}
      {submitted && (
        <div className={styles.celebrationOverlay}>
          <div className={styles.confettiWrap} aria-hidden="true">
            {confettiParticles.map(p => (
              <div key={p.id} className={styles.confettiPiece} style={p.style} />
            ))}
          </div>
          <motion.div
            className={styles.celebrationCard}
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <div className={styles.celebrationIconWrap}>
              <CheckCircle size={48} aria-hidden="true" />
            </div>
            <h2 className={styles.celebrationTitle}>¡Gracias por tu compra!</h2>
            <p className={styles.celebrationSubtitle}>
              Tu pedido fue enviado por WhatsApp.<br />El negocio lo recibirá en breve.
            </p>
            <button
              type="button"
              className={styles.celebrationBtn}
              onClick={() => { setSubmitted(false); setCheckoutOpen(false) }}
            >
              Seguir comprando
            </button>
          </motion.div>
        </div>
      )}

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
                <p className={styles.productCategory}>{selP.categoryName}</p>
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
                      onClick={() => setModalQty(q => q + 1)}
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
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
    </>
  )
}
