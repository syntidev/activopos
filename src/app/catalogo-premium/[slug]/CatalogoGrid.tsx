'use client'

import { useState, useMemo, useRef, useEffect, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, X, MessageCircle, ShoppingBag, Plus, Minus, Search,
  Star, Archive, Menu, Flame, Sparkles, Tag, ThumbsUp,
  Info, AtSign, Phone, Share2, ArrowUp, SlidersHorizontal, Grid,
  Truck, ShieldCheck, ImageOff,
} from 'lucide-react'
import { useCart } from './CartContext'
import { CartDrawer } from './CartDrawer'
import { CatalogHeader } from './CatalogHeader'
import { LandingSections } from './LandingSections'
import { AnnouncementPopup } from './AnnouncementPopup'
import { ImgWithFallback } from './ImgWithFallback'
import { NovedadesSection } from './NovedadesSection'
import { CarteleraGrid } from './CarteleraGrid'
import type { CarteleraData } from './cartelera'
import { MobileTabBar } from './MobileTabBar'
import { FilterPanel } from './FilterPanel'
import type { RenderableLandingSection } from '@/lib/landing-sections'
import { capitalize, currencyVisibility, categoryBadgeColor, getConsultarWaUrl, getInitials } from './catalogUtils'
import { normalizePhone } from '@/lib/utils'
import styles from './catalogo.module.css'

/* ── Public interfaces ───────────────────────────────────────── */

export interface CatalogProductVariant {
  id:              number
  tipo:            string
  valor:           string
  stock:           number
  precio_extra:    number
  combination_key: string | null
  variant_group:   string | null
  sku:             string | null
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
  // Precio directo en $ para pago EN divisas -- ver Product.precio_divisa.
  // null = sin precio propio en divisas, el carrito solo muestra Bs.
  priceDivisa:       number | null
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
  businessId:     number
  products:       CatalogProduct[]
  categories:     string[]
  categoryColors: Record<string, string | null>
  categoryImages: Record<string, string | null>
  slug:           string
  rate:           number
  currency:       string
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
  initialQuery?:      string | null
  landingSections?:   RenderableLandingSection[]
  /** Cartelera de campaña activa (grid premium 1+4); null/omitida = bloque de colección de siempre */
  cartelera?:         CarteleraData | null
  brands?:            CatalogBrand[]
}

export interface CatalogBrand {
  name:        string
  image_url:   string | null
  search_term: string
}

/* ── Helpers ─────────────────────────────────────────────────── */

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
/** Cards de la sección Novedades (grid 4×2 del mockup: 8 productos). */
const NOVEDADES_COUNT = 8

// TODO(Carlos/Daniel): copy SIN CONFIRMAR. Tomado tal cual de las "ideas de
// diseño" en .doc/PLAN_TRABAJO_OnBike_ActivoPOS.md (Gran Fondo 200K, Zafeti,
// líneas de marca) -- son hechos reales del negocio según ese documento, pero
// nadie validó todavía el TEXTO exacto (títulos/subtítulos) como copy final
// de producción. No dar por aprobado hasta que Carlos confirme con Daniel.
// Mini-banners temáticos intercalados entre secciones (patrón Walmart de
// bloques, sin urgencia ni descuentos) — contenido fijo del tenant OnBike.
const MINI_BANNERS: { title: string; subtitle: string }[] = [
  { title: 'Gran Fondo Virgen del Valle 200K', subtitle: 'El evento insignia del ciclismo en Margarita — prepárate con nosotros' },
  { title: 'Agentes autorizados Zafeti',        subtitle: 'Indumentaria y uniformes oficiales para ciclismo' },
  { title: 'Garmin · Oakley · Kask',            subtitle: 'Líneas de marca disponibles en tienda' },
]

/* ── Component ───────────────────────────────────────────────── */

export function CatalogoGrid({
  businessId,
  products,
  categories,
  categoryColors,
  categoryImages,
  slug,
  rate,
  currency,
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
  initialQuery = null,
  landingSections = [],
  cartelera = null,
  brands = [],
}: Props) {
  const { showUsd, showBs } = currencyVisibility(currency)
  const router = useRouter()
  const { cart, cartOpen, setCartOpen, checkoutOpen, addToCart: addItemToCart } = useCart()

  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory)
  const [activeSub,      setActiveSub]      = useState<string | null>(null)
  const [query,          setQuery]          = useState(initialQuery ?? '')
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
  const [activePriceRange, setActivePriceRange] = useState<{ min: number; max: number } | null>(null)
  // Panel de filtros real de /productos (precio + marca + categoría, AND
  // combinado con lo que ya filtre el sidebar/búsqueda). filterCategories es
  // multi-select, independiente del sidebar (activeCategory, single-select).
  const [filterPanelOpen,   setFilterPanelOpen]   = useState(false)
  const [filterCategories,  setFilterCategories]  = useState<string[]>([])
  const [filterBrands,      setFilterBrands]      = useState<string[]>([])

  const closeRef  = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const categoryTrackRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  // El scroll vive en `.root` (page.tsx), no en window. El header es hijo directo
  // de `.root`, así que su parentElement es el contenedor scrolleable.
  const getScroller = (): HTMLElement | null => headerRef.current?.parentElement ?? null

  const scrollToTop = () => {
    getScroller()?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Muestra "volver al inicio" tras bajar una pantalla + header desktop pasa
  // a glass (blur) recién al scrollear -- mismo listener, un solo scroll.
  useEffect(() => {
    const scroller = getScroller()
    if (!scroller) return
    const onScroll = () => {
      setShowBackTop(scroller.scrollTop > 600)
      setIsScrolled(scroller.scrollTop > 8)
    }
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

  // Novedades: primero los marcados 'nuevo'; se completa con los ingresos más
  // recientes (id descendente como proxy: CatalogProduct no trae created_at).
  // Solo productos con stock; sin ninguno, la sección no se renderiza.
  // Se recorta a múltiplo de 4 (no solo NOVEDADES_COUNT): el grid es 4 col
  // desktop / 2 col mobile, y 4 es múltiplo de ambas -- evita la última fila
  // incompleta (ej. 6 items en grid de 4 dejaba 2 columnas vacías) sin
  // depender de que siempre haya exactamente NOVEDADES_COUNT disponibles.
  const novedades = useMemo(() => {
    const inStock = products.filter(p => !p.outOfStock)
    const flagged = inStock.filter(p => p.badge === 'nuevo')
    const recent  = inStock.filter(p => p.badge !== 'nuevo').sort((a, b) => b.id - a.id)
    const available = [...flagged, ...recent].slice(0, NOVEDADES_COUNT)
    const fullRows = Math.floor(available.length / 4) * 4
    return available.slice(0, fullRows)
  }, [products])

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

  // Todos los filtros combinan en AND -- panel de filtros (precio/marca/
  // categoría múltiple) nunca es mutuamente excluyente con búsqueda/sidebar,
  // a diferencia del comportamiento anterior (un solo filtro a la vez).
  const visible = useMemo(() => {
    let result = products

    if (query.trim()) {
      const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      result = result.filter(p =>
        p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
        (p.categoryName?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '').includes(q),
      )
    }

    if (activeCategory === FEATURED_KEY) {
      result = result.filter(p => p.isFeatured)
    } else if (activeCategory) {
      result = result.filter(p => p.categoryName === activeCategory)
      if (activeSub) result = result.filter(p => p.subcategory === activeSub)
    }

    if (filterCategories.length > 0) {
      result = result.filter(p => p.categoryName != null && filterCategories.includes(p.categoryName))
    }

    // GAP-BRAND-FILTER: Product no tiene brand_id/relación real a Brand (ver
    // schema.prisma) -- Brand es solo el tile de "Comprá por marca", nunca se
    // ligó a productos concretos. Mismo criterio que esos tiles ya usan
    // (?buscar=<marca>): coincidencia de texto contra el nombre del producto,
    // no un filtro relacional preciso. Documentado, no es un filtro exacto.
    if (filterBrands.length > 0) {
      const terms = filterBrands.map(b => b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      result = result.filter(p => {
        const name = p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        return terms.some(t => name.includes(t))
      })
    }

    if (activePriceRange) {
      result = result.filter(p => p.priceUsd > 0 && p.priceUsd >= activePriceRange.min && p.priceUsd < activePriceRange.max)
    }

    return result
  }, [products, query, activeCategory, activeSub, filterCategories, filterBrands, activePriceRange])

  // Reset paginación al cambiar filtro o búsqueda — patrón SYNTImeat
  useEffect(() => { setVisibleCount(10) }, [activeCategory, activeSub, query, activePriceRange, filterCategories, filterBrands])

  const paged     = visible.slice(0, visibleCount)
  const remaining = visible.length - visibleCount

  // ── Modo browse: vitrina apilada por categoría con scroll-spy ──
  // Activo solo sin filtro de categoría real, precio ni búsqueda; Destacados y
  // subcategorías siguen usando el grid filtrado único de arriba.
  const browseMode = activeCategory === null && !query.trim() && !activePriceRange
    && filterCategories.length === 0 && filterBrands.length === 0

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

  // ── Restructuración patrón conversión (Flatsome-validated) — extrae hero/
  // banner-de-marca/foto-ambiente de Landing Sections para posicionarlos en
  // el orden fijo de la página, en vez del orden libre por `order` de DB.
  // community y el texto completo de story quedan archivados (código intacto
  // en LandingSections.tsx, solo sin invocar acá).
  const heroSection = useMemo(() =>
    landingSections.find((s): s is Extract<RenderableLandingSection, { type: 'hero' }> => s.type === 'hero')
  , [landingSections])

  const brandBannerSection = useMemo(() =>
    landingSections.find((s): s is Extract<RenderableLandingSection, { type: 'event_slider' }> => s.type === 'event_slider')
  , [landingSections])

  const ambientPhotoSection = useMemo(() =>
    landingSections.find((s): s is Extract<RenderableLandingSection, { type: 'story' }> => s.type === 'story')
  , [landingSections])

  // Restructuración a64526b reescribió el render entero y dejó de invocar
  // AnnouncementPopup (el componente y su lógica de localStorage seguían
  // intactos, solo nadie lo montaba) -- root cause de que el popup nunca
  // se viera funcionando pese a estar implementado.
  const popupSection = useMemo(() =>
    landingSections.find((s): s is Extract<RenderableLandingSection, { type: 'announcement_popup' }> => s.type === 'announcement_popup')
  , [landingSections])

  // Mismo caso que el popup: collection_grid (Línea 200K) quedó sin
  // extraer del restructure -- el mecanismo de render ya existe en
  // LandingSections.tsx, solo faltaba invocarlo acá.
  const collectionGridSection = useMemo(() =>
    landingSections.find((s): s is Extract<RenderableLandingSection, { type: 'collection_grid' }> => s.type === 'collection_grid')
  , [landingSections])

  // Primera categoría no vacía, mismo orden que el admin definió en
  // Configuración > Categorías — proxy real de "categoría más relevante"
  // sin inventar un campo de popularidad que no existe.
  const topCategorySection = sections.find(s => s.key !== ORPHAN_KEY) ?? null

  // Grid final mixto — 4 columnas por criterio real disponible (badge nuevo,
  // isFeatured, categorías siguientes). Nunca fuerza 4 columnas fabricadas:
  // si hay menos señales reales, hay menos columnas.
  const finalGridColumns = useMemo(() => {
    const cols: { title: string; items: CatalogProduct[] }[] = []
    if (nuevosIngresos.length) cols.push({ title: 'Nuevo', items: nuevosIngresos.slice(0, 4) })
    const featured = products.filter(p => p.isFeatured)
    if (featured.length) cols.push({ title: 'Destacado', items: featured.slice(0, 4) })
    for (const s of sections) {
      if (cols.length >= 4) break
      if (s.key === ORPHAN_KEY) continue
      if (cols.some(c => c.title === s.name)) continue
      cols.push({ title: s.name, items: s.items.slice(0, 4) })
    }
    // Columnas independientes con distinto largo (ej. "Nuevo" con 2 items vs.
    // "Destacado" con 4) dejan un hueco al fondo de la más corta, sandwicheado
    // entre columnas completas -- se pareja todo al mínimo real, nunca se
    // rellena con productos inventados (Cero Fachadas).
    const trimmed = cols.slice(0, 4)
    const minLen = trimmed.length ? Math.min(...trimmed.map(c => c.items.length)) : 0
    return trimmed.map(c => ({ ...c, items: c.items.slice(0, minLen) }))
  }, [nuevosIngresos, products, sections])

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
      // precio_divisa (si existe) es el precio final real, no un tachado
      // decorativo -- el carrito cobra ese, no el de lista.
      price_usd:     (product.priceDivisa ?? product.priceUsd) + (variant?.precio_extra ?? 0),
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
    setActivePriceRange(null)
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
    setActivePriceRange(null)
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
        onClick={() => router.push(`/catalogo-premium/${slug}/p/${p.id}`)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/catalogo-premium/${slug}/p/${p.id}`) }
        }}
        tabIndex={isOut ? -1 : 0}
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
              style={{ '--badge-color': categoryBadgeColor(p.categoryName, categoryColors[p.categoryName]) } as CSSProperties}
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
          <div className={styles.productPriceBlock}>
            {p.catalogVisibility === 'on_request' ? (
              <span className={styles.priceConsultar}>Consultar precio</span>
            ) : p.availability === 'discontinued' ? (
              <span className={styles.priceDiscontinued}>No disponible</span>
            ) : p.priceUsd > 0 ? (
              <>
                {showUsd && (
                  <>
                    {/* precio_divisa existe: precio normal (precio_bcv) tachado arriba,
                        precio_divisa como destacado -- Bs abajo sigue leyendo priceUsd/
                        priceBs sin cambio, es el precio_bcv convertido para quien paga
                        en bolívares (Pago Móvil/efectivo Bs). */}
                    {p.priceDivisa !== null && p.priceDivisa > 0 && (
                      <span className={styles.priceUsdOld}>
                        <span className={styles.priceSymbol}>$</span>
                        {p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={styles.priceUsd}>
                      <span className={styles.priceSymbol}>$</span>
                      {(p.priceDivisa ?? p.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
                {showBs && p.priceBs && (
                  <span className={styles.priceBs}>
                    Bs.&nbsp;{p.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </>
            ) : (
              <span className={styles.priceConsultar}>Consultar precio</span>
            )}
          </div>

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
                p.variants.length > 0
                  ? router.push(`/catalogo-premium/${slug}/p/${p.id}`)
                  : addToCart(p, 1)
              }}
              aria-label={
                p.variants.length > 0
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

  // Fila compacta — sección final "4 columnas con título" (patrón Flatsome
  // Classic Shop: foto chica + nombre + precio, sin badges ni CTA propio,
  // clic navega al detalle). Distinta a propósito de renderProductCard
  // (esa es la card grande del resto del catálogo) -- acá el objetivo es una
  // lista densa, no otra vitrina de cards.
  const renderCompactRow = (p: CatalogProduct) => (
    <a
      key={p.id}
      href={`/catalogo-premium/${slug}/p/${p.id}`}
      className={styles.compactRow}
      onClick={e => { e.preventDefault(); router.push(`/catalogo-premium/${slug}/p/${p.id}`) }}
    >
      <span className={styles.compactThumb}>
        {p.image ? (
          <ImgWithFallback
            src={p.image}
            className={styles.compactThumbImg}
            loading="lazy"
            fallback={<span className={styles.compactThumbInitial}>{p.name.charAt(0).toUpperCase()}</span>}
          />
        ) : (
          <span className={styles.compactThumbInitial}>{p.name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className={styles.compactInfo}>
        <span className={styles.compactName}>{p.name}</span>
        {p.catalogVisibility === 'on_request' ? (
          <span className={styles.compactPriceConsultar}>Consultar</span>
        ) : p.priceUsd > 0 ? (
          <span className={styles.compactPriceRow}>
            {showUsd && (
              <>
                {p.priceDivisa !== null && p.priceDivisa > 0 && (
                  <span className={styles.compactPriceOld}>
                    ${p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <span className={styles.compactPrice}>
                  ${(p.priceDivisa ?? p.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </>
            )}
            {showBs && p.priceBs && (
              <span className={styles.compactPriceBs}>
                Bs.&nbsp;{p.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            )}
          </span>
        ) : (
          <span className={styles.compactPriceConsultar}>Consultar</span>
        )}
      </span>
    </a>
  )

  return (
    <>
      {/* ── Sticky header ──────────────────────────────────────── */}
      {/* Extraído a CatalogHeader.tsx (compartido con /kit-200k) -- misma
          nav/logo/iconCluster, esta vista solo aporta ref+isScrolled del
          scroller .root y los callbacks de buscar/info. */}
      <CatalogHeader
        ref={headerRef}
        slug={slug}
        businessName={businessName}
        businessLogo={businessLogo}
        businessCity={businessCity}
        isScrolled={isScrolled}
        onSearchClick={() => setSearchExpanded(true)}
        onInfoClick={() => setInfoOpen(true)}
      />

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
            {/* navSearchBtnDesktopHidden: en desktop el buscar ya vive en el
                cluster del header (styles.desktopSearchBtn) -- mostrar los
                dos sería redundante. */}
            <button
              type="button"
              className={`${styles.navIconBtn} ${styles.navSearchBtnDesktopHidden}`}
              onClick={() => setSearchExpanded(true)}
              aria-label="Buscar productos"
            >
              <Search size={18} aria-hidden="true" />
            </button>

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
                    href={`/catalogo-premium/${slug}`}
                    role="menuitem"
                    className={styles.catMenuItem}
                    onClick={() => setCatMenuOpen(false)}
                  >
                    Inicio
                  </Link>
                  <Link
                    href={`/catalogo-premium/${slug}/productos`}
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
              onClick={() => setFilterPanelOpen(true)}
              aria-expanded={filterPanelOpen}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filtros
              {(filterCategories.length + filterBrands.length + (activePriceRange ? 1 : 0)) > 0 && (
                <span className={styles.catalogFiltrosBadge}>
                  {filterCategories.length + filterBrands.length + (activePriceRange ? 1 : 0)}
                </span>
              )}
            </button>
            <span className={styles.catalogCount}>
              {visible.length} producto{visible.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 1: Hero — único tipo de Landing Section que se pasa acá,
          extraído explícitamente (no el mapper genérico) para fijar su
          posición #1 sin depender del `order` de DB. ── */}
      {catalogMode === 'home' && browseMode && heroSection && (
        <LandingSections sections={[heroSection]} slug={slug} businessId={businessId} />
      )}

      {/* ── Hero banner genérico — solo si el tenant NO configuró un hero
          de Landing Sections (evita hero duplicado) ── */}
      {catalogMode === 'home' && browseMode && !heroSection && (() => {
        const covers = heroCovers?.length ? heroCovers : heroCover ? [heroCover] : []
        if (!covers.length) return (
          <section className={styles.heroBanner}>
            <span className={styles.constellationLight} aria-hidden="true" />
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
            onClick={() => router.push(`/catalogo-premium/${slug}/productos`)}
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
            <span className={styles.constellationLight} aria-hidden="true" />
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

      {/* ── Collection grid (Línea 200K) — mismo caso que el popup: el
          restructure dejó de invocar este tipo de sección aunque el
          renderer (LandingSections.tsx) sigue intacto. ── */}
      {/* Cartelera de campaña activa (grid premium 1+4, data-driven por
          Collection.is_cartelera_activa) REEMPLAZA a este bloque fijo. Sin cartelera
          activa (o con menos de 5 productos) sigue el bloque de colección de siempre,
          para que activar/desactivar campañas nunca deje la página sin este espacio. */}
      {catalogMode === 'home' && browseMode && (
        cartelera
          ? <CarteleraGrid data={cartelera} slug={slug} />
          : collectionGridSection && (
              <LandingSections sections={[collectionGridSection]} slug={slug} businessId={businessId} />
            )
      )}

      {/* ── SECCIÓN 2: Marcas — reposicionada inmediatamente después del
          Hero (antes vivía casi al final). Mecanismo sin tocar (Brand
          real + scroll horizontal ya resuelto), solo cambia el orden. ── */}
      {catalogMode === 'home' && browseMode && brands.length > 0 && (
        <section id="marcas" className={styles.brandSection} aria-label="Marcas">
          <div className={styles.brandHeader}>
            <span className={styles.brandTitle}>
              <Tag size={16} aria-hidden="true" />
              Comprá por marca
            </span>
          </div>
          <div className={styles.brandScroll}>
            {brands.map(brand => (
              <Link
                key={brand.name}
                href={`/catalogo-premium/${slug}/productos?buscar=${encodeURIComponent(brand.search_term)}`}
                className={styles.brandCard}
              >
                <span className={styles.brandCardMedia}>
                  {brand.image_url ? (
                    <img src={brand.image_url} alt="" className={styles.brandCardImg} />
                  ) : (
                    <>
                      <span className={styles.constellationDark} aria-hidden="true" />
                      <span className={styles.brandCardInitial}>{brand.name.charAt(0)}</span>
                    </>
                  )}
                </span>
                <span className={styles.brandCardName}>{brand.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── SECCIÓN 3: Riel de productos destacados — scroll horizontal
          (antes era grid vertical `.featuredGrid`), mismo patrón shelfTrack
          que el resto del catálogo. Empty-state compacto DENTRO de la
          sección si el catálogo real está vacío, nunca un bloque aislado. ── */}
      {catalogMode === 'home' && browseMode && (
        <section className={styles.featuredSection} data-section="featured" aria-label="Productos destacados">
          <div className={styles.featuredHeader}>
            <div className={styles.featuredTitlePill}>
              <Star size={14} aria-hidden="true" />
              Productos Destacados
            </div>
            {hasFeatured && (
              <button type="button" className={styles.shelfVerTodos} onClick={() => selectCategory(FEATURED_KEY)}>
                Ver todos →
              </button>
            )}
          </div>
          {products.length === 0 ? (
            <div className={styles.empty}>
              <Package className={styles.emptyIcon} size={36} strokeWidth={1.25} aria-hidden="true" />
              <p className={styles.emptyTitle}>Catálogo en construcción</p>
              <p className={styles.emptySubtitle}>Este negocio está preparando su vitrina digital.</p>
            </div>
          ) : (
            <div className={styles.shelfTrack}>
              {(hasFeatured ? products.filter(p => p.isFeatured) : products.slice(0, 8)).map((p, i) => (
                <div key={p.id} className={styles.shelfCard}>
                  {renderProductCard(p, i)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── SECCIÓN 5: Fila de confianza — reemplaza el hueco decorativo de
          "Ruta/Montaña/Urbano" (nunca tuvo clasificación real de producto,
          puramente decorativo, generaba espacio vacío). 3 íconos, franja
          delgada, sin foto. ── */}
      {catalogMode === 'home' && browseMode && (
        <section className={styles.trustStripSection} aria-label="Confianza">
          <div className={styles.trustStripItem}>
            <Truck size={22} aria-hidden="true" />
            <div>
              <p className={styles.trustStripTitle}>Envío en Margarita</p>
              <p className={styles.trustStripDesc}>Coordinamos entrega en toda la isla.</p>
            </div>
          </div>
          <div className={styles.trustStripItem}>
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <p className={styles.trustStripTitle}>Garantía de marca oficial</p>
              <p className={styles.trustStripDesc}>Distribuidor autorizado, producto original.</p>
            </div>
          </div>
          <div className={styles.trustStripItem}>
            <MessageCircle size={22} aria-hidden="true" />
            <div>
              <p className={styles.trustStripTitle}>Atención directa</p>
              <p className={styles.trustStripDesc}>Escríbenos por WhatsApp, respondemos rápido.</p>
            </div>
          </div>
        </section>
      )}

      {/* ── SECCIÓN 6: Riel por categoría — mismo patrón que Destacados,
          filtrado a la primera categoría real (orden del admin), no una
          métrica de popularidad inventada. ── */}
      {catalogMode === 'home' && browseMode && (
        <section className={styles.featuredSection} aria-label="Productos por categoría">
          <div className={styles.featuredHeader}>
            <div className={styles.featuredTitlePill}>
              <Sparkles size={14} aria-hidden="true" />
              {topCategorySection ? `Lo más nuevo en ${topCategorySection.name}` : 'Por categoría'}
            </div>
            {topCategorySection && (
              <button
                type="button"
                className={styles.shelfVerTodos}
                onClick={() => router.push(`/catalogo-premium/${slug}/productos?categoria=${encodeURIComponent(topCategorySection.key)}`)}
              >
                Ver todos →
              </button>
            )}
          </div>
          {!topCategorySection ? (
            <div className={styles.empty}>
              <Package className={styles.emptyIcon} size={36} strokeWidth={1.25} aria-hidden="true" />
              <p className={styles.emptyTitle}>Aún sin categorías con productos</p>
              <p className={styles.emptySubtitle}>Se completa automáticamente al cargar inventario.</p>
            </div>
          ) : (
            <div className={styles.shelfTrack}>
              {topCategorySection.items.map((p, i) => (
                <div key={p.id} className={styles.shelfCard}>
                  {renderProductCard(p, i, topCategorySection.color)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── SECCIÓN 7: Banner de marca rotativo — repurpose del EventSlider
          ya construido (crossfade, autoplay, dots+flechas): NO se reconstruyó,
          solo cambia dónde vive en la página y qué representa el contenido
          (publicidad de marca, no evento). Lado de texto y contraste se leen
          del propio slide en LandingSections.tsx, no hardcodeados acá. ── */}
      {catalogMode === 'home' && browseMode && brandBannerSection && (
        <LandingSections sections={[brandBannerSection]} slug={slug} businessId={businessId} />
      )}

      {/* ── SECCIÓN 7.5: Novedades — grid mixto del mockup (§6). Va pegada al
          slider: cierra el hueco con contenido real (productos del catálogo). ── */}
      {catalogMode === 'home' && browseMode && novedades.length > 0 && (
        <NovedadesSection products={novedades} slug={slug} />
      )}

      {/* ── SECCIÓN 8: Franja de foto ambiente — todo lo que sobrevive del
          bloque "Nuestra Historia": SOLO la imagen, sin eyebrow/título/párrafo
          largo. El texto completo y "La comunidad OnBike" quedan archivados
          en LandingSections.tsx (código intacto, sin invocar acá) para
          onbikemargarita.com. ── */}
      {/* Solo la imagen, nada más en la sección (ver comentario arriba) --
          sin image_url real no hay nada que mostrar: el fallback dejaba un
          bloque de ~380px con solo el placeholder decorativo, mismo patrón
          de "sección sin contenido real" ya visto hoy en Novedades. Gate
          explícito en vez de dejar que ImgWithFallback absorba el vacío. */}
      {catalogMode === 'home' && browseMode && ambientPhotoSection?.config.image_url && (
        <section className={styles.ambientPhotoSection} aria-label="Foto ambiente">
          <ImgWithFallback
            src={ambientPhotoSection.config.image_url}
            className={styles.ambientPhotoImg}
            loading="lazy"
            fallback={
              <div className={styles.ambientPhotoPlaceholder} aria-hidden="true">
                <ImageOff size={28} strokeWidth={1.5} />
              </div>
            }
          />
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

      {/* ── Chips de filtros aplicados — removibles, arriba del grid ── */}
      {catalogMode === 'productos' && (filterCategories.length > 0 || filterBrands.length > 0 || activePriceRange) && (
        <div className={styles.filterChipsRow} role="group" aria-label="Filtros aplicados">
          {activePriceRange && (
            <button type="button" className={styles.filterChip} onClick={() => setActivePriceRange(null)}>
              ${activePriceRange.min} - ${activePriceRange.max}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {filterCategories.map(cat => (
            <button
              key={cat}
              type="button"
              className={styles.filterChip}
              onClick={() => setFilterCategories(prev => prev.filter(c => c !== cat))}
            >
              {cat}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          {filterBrands.map(brand => (
            <button
              key={brand}
              type="button"
              className={styles.filterChip}
              onClick={() => setFilterBrands(prev => prev.filter(b => b !== brand))}
            >
              {brand}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className={styles.filterChipsClear}
            onClick={() => { setActivePriceRange(null); setFilterCategories([]); setFilterBrands([]) }}
          >
            Limpiar todo
          </button>
        </div>
      )}

      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        categories={categories}
        brands={brands}
        selectedCategories={filterCategories}
        selectedBrands={filterBrands}
        priceRange={activePriceRange}
        onApply={(next) => {
          setFilterCategories(next.categories)
          setFilterBrands(next.brands)
          setActivePriceRange(next.priceRange)
          setFilterPanelOpen(false)
        }}
      />

      {/* ── Product grid ───────────────────────────────────────── */}
      <main className={styles.productsSection} data-section="products">
        {products.length === 0 ? (
          <div className={styles.empty}>
            <Package className={styles.emptyIcon} size={52} strokeWidth={1.25} aria-hidden="true" />
            <h2 className={styles.emptyTitle}>Catálogo en construcción</h2>
            <p className={styles.emptySubtitle}>Este negocio está preparando su vitrina digital.</p>
          </div>
        ) : (browseMode && catalogMode === 'home') ? (
          // ── SECCIÓN 9: 4 columnas con título, patrón Flatsome Classic Shop
          // (LATEST/BEST SELLING/FEATURED/TOP RATED) -- título propio por
          // criterio real disponible (nuevo/destacado/categorías), lista
          // vertical compacta (foto chica+nombre+precio, renderCompactRow),
          // no la card grande del resto del catálogo. ──
          <div className={styles.finalMixedGrid}>
            {finalGridColumns.map(col => (
              <div key={col.title} className={styles.finalMixedCol}>
                <h2 className={styles.finalMixedColTitle}>{col.title}</h2>
                <div className={styles.finalMixedList}>
                  {col.items.map(p => renderCompactRow(p))}
                </div>
              </div>
            ))}
          </div>
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

      <CartDrawer slug={slug} rate={rate} currency={currency} paymentMethods={paymentMethods} />

      {popupSection && (
        <AnnouncementPopup config={popupSection.config} businessId={businessId} sectionId={popupSection.id} />
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
                <ImgWithFallback
                  src={selP.images[modalImageIndex] ?? selP.image}
                  className={styles.modalImage}
                  fallback={
                    <div
                      className={`${styles.modalImagePlaceholder} ${styles.gradDefault}`}
                      aria-hidden="true"
                    >
                      <span className={styles.modalInitial}>
                        {selP.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  }
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
                  style={{ '--badge-color': categoryBadgeColor(selP.categoryName, categoryColors[selP.categoryName]) } as CSSProperties}
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
                    {showUsd && (
                      <div className={styles.modalPriceUsdCol}>
                        {selP.priceDivisa !== null && selP.priceDivisa > 0 && (
                          <span className={styles.modalPriceOld}>
                            ${selP.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        <span>
                          <span className={styles.modalPriceSymbol}>$</span>
                          <span className={styles.modalPriceNumber}>
                            {(selP.priceDivisa ?? selP.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </span>
                      </div>
                    )}
                    {showBs && selP.priceBs && (
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
                                {v.valor}{v.sku ? ` (${v.sku})` : ''}
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
                    Agregar · ${(((selP.priceDivisa ?? selP.priceUsd) + (selectedVariant?.precio_extra ?? 0)) * modalQty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </button>
                  {/* Directo desde la ficha, no solo al final del carrito -- misma
                      URL/mensaje que "Consultar disponibilidad" arriba (getConsultarWaUrl). */}
                  {businessPhone && (
                    <a
                      href={getConsultarWaUrl(businessPhone, selP.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.btnWhatsappIcon}
                      aria-label={`Consultar ${selP.name} por WhatsApp`}
                    >
                      <MessageCircle size={20} aria-hidden="true" />
                    </a>
                  )}
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
                      href={`https://wa.me/${normalizePhone(businessPhone)}`}
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
          href={`https://wa.me/${normalizePhone(businessPhone)}?text=${encodeURIComponent('Hola, vi tu catálogo en ActivoPOS y me interesa pedir.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waFab}
          aria-label="Contactar por WhatsApp"
        >
          <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
          <span className={styles.waFabText}>Pedir por WhatsApp</span>
        </a>
      )}

      <MobileTabBar
        slug={slug}
        onSearchClick={() => setSearchExpanded(true)}
        onAccountClick={() => setInfoOpen(true)}
      />
    </>
  )
}
