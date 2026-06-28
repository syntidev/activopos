'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package, X, MessageCircle, ShoppingBag, Plus, Minus, Search,
  CheckCircle, Star, Archive, MapPin,
} from 'lucide-react'
import styles from './catalogo.module.css'

/* ── Public interfaces ───────────────────────────────────────── */

export interface CatalogProduct {
  id:                number
  name:              string
  description:       string | null
  image:             string | null
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
}

export interface PaymentMethod {
  id:   number
  name: string
  type: string
}

/* ── Internal types ──────────────────────────────────────────── */

interface CartItem {
  product_id: number
  name:       string
  qty:        number
  price_usd:  number
  image_url:  string | null
}

interface Props {
  products:       CatalogProduct[]
  categories:     string[]
  slug:           string
  rate:           number
  paymentMethods: PaymentMethod[]
  businessPhone:  string
  businessName:   string
  businessLogo:   string | null
  businessCity:   string | null
  businessDesc:   string | null
}

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function getCategoryClass(categoryName: string | null | undefined): string {
  if (!categoryName) return styles.gradDefault
  const key = categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const map: Record<string, string> = {
    ropa:       styles.gradRopa,
    alimentos:  styles.gradAlimentos,
    tecnologia: styles.gradTech,
    servicios:  styles.gradServicios,
  }
  return map[key] ?? styles.gradDefault
}

const FEATURED_KEY = '__destacados__'

const CONFETTI_COLORS = ['#0038BD','#FF6B35','#FFD700','#10B981','#F472B6','#8B5CF6','#EF4444','#06B6D4']

/* ── Component ───────────────────────────────────────────────── */

export function CatalogoGrid({
  products,
  categories,
  slug,
  rate,
  paymentMethods,
  businessPhone,
  businessName,
  businessLogo,
  businessCity,
  businessDesc,
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
  const [cRef,           setCRef]           = useState('')
  const [cPayment,       setCPayment]       = useState(paymentMethods[0]?.name ?? '')
  const [submitting,     setSubmitting]     = useState(false)
  const [submitted,      setSubmitted]      = useState(false)

  const closeRef  = useRef<HTMLButtonElement>(null)
  const nameRef   = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  const subcategoriesForActive = useMemo(() => {
    if (!activeCategory || activeCategory === FEATURED_KEY) return []
    const subs = new Set<string>()
    for (const p of products) {
      if (p.categoryName === activeCategory && p.subcategory) subs.add(p.subcategory)
    }
    return Array.from(subs).sort()
  }, [products, activeCategory])

  useEffect(() => { setActiveSub(null) }, [activeCategory])

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

  // Cart computed
  const totalItems  = cart.reduce((acc, i) => acc + i.qty, 0)
  const subtotalUsd = cart.reduce((acc, i) => acc + i.qty * i.price_usd, 0)
  const subtotalBs  = subtotalUsd * rate

  const addToCart = (product: CatalogProduct, qty: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id ? { ...i, qty: i.qty + qty } : i,
        )
      }
      return [...prev, {
        product_id: product.id,
        name:       product.name,
        qty,
        price_usd:  product.priceUsd,
        image_url:  product.image,
      }]
    })
  }

  const updateCartQty = (productId: number, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.product_id === productId)
      if (!item) return prev
      const newQty = item.qty + delta
      if (newQty <= 0) return prev.filter(i => i.product_id !== productId)
      return prev.map(i => i.product_id === productId ? { ...i, qty: newQty } : i)
    })
  }

  const openModal  = (p: CatalogProduct) => { setSelectedProduct(p); setModalQty(1) }
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
      if (checkoutOpen && !submitting) { setCheckoutOpen(false); return }
      if (selectedProduct)            { closeModal(); return }
      if (cartOpen)                   { setCartOpen(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [checkoutOpen, selectedProduct, cartOpen, submitting])

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

  const handleCheckout = async () => {
    if (!cName.trim() || !cPhone.trim() || !cPayment.trim() || cart.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/catalog/${slug}/order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items:              cart.map(i => ({ product_id: i.product_id, qty: i.qty })),
          customer_name:      cName.trim(),
          customer_phone:     cPhone.trim(),
          customer_reference: cRef.trim() || 'Sin especificar',
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
        }, 3000)
      }
    } catch { /* user stays in form */ }
    finally { setSubmitting(false) }
  }

  const selP = selectedProduct

  return (
    <>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header className={styles.stickyHeader}>
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
          <span className={styles.headerName}>{businessName}</span>
        </div>

        <button
          type="button"
          className={styles.stickyCartBtn}
          onClick={() => setCartOpen(true)}
          aria-label={`Carrito — ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`}
        >
          <ShoppingBag size={20} aria-hidden="true" />
          {totalItems > 0 && (
            <span key={totalItems} className={styles.cartCount} aria-hidden="true">
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
        </button>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className={styles.hero} aria-label="Información del negocio">
        <div className={styles.heroContent}>
          {businessLogo ? (
            <img
              src={businessLogo}
              alt=""
              className={styles.heroLogoImg}
            />
          ) : (
            <span className={styles.heroLogoInitials} aria-hidden="true">
              {initials}
            </span>
          )}
          <h1 className={styles.heroTitle}>{businessName}</h1>
          <div className={styles.heroMeta}>
            {businessCity && (
              <span className={styles.heroMetaItem}>
                <MapPin size={10} aria-hidden="true" />
                {businessCity}
              </span>
            )}
            <span className={styles.heroBadgeOpen}>
              <span className={styles.heroDot} aria-hidden="true" />
              Abierto
            </span>
          </div>
        </div>
      </section>

      {/* ── Search bar (sticky) ────────────────────────────────── */}
      <div className={styles.searchBar} role="search">
        <Search size={16} className={styles.searchBarIcon} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          className={styles.searchBarInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar productos…"
          aria-label="Buscar productos"
        />
        {query && (
          <button
            type="button"
            className={styles.searchBarClear}
            onClick={() => { setQuery(''); searchRef.current?.focus() }}
            aria-label="Limpiar búsqueda"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Category tabs (horizontal scroll) ─────────────────── */}
      {!query && (
        <>
          <div className={styles.categoryScroll}>
            <div className={styles.categoryTrack} role="tablist" aria-label="Filtrar por categoría">
              {hasFeatured && (
                <button
                  role="tab"
                  aria-selected={activeCategory === FEATURED_KEY}
                  className={`${styles.categoryTab} ${activeCategory === FEATURED_KEY ? styles.categoryTabActive : ''}`}
                  onClick={() => setActiveCategory(FEATURED_KEY)}
                >
                  <Star size={13} aria-hidden="true" />
                  Destacados
                  <span className={styles.categoryTabCount}>{products.filter(p => p.isFeatured).length}</span>
                </button>
              )}
              <button
                role="tab"
                aria-selected={activeCategory === null}
                className={`${styles.categoryTab} ${activeCategory === null ? styles.categoryTabActive : ''}`}
                onClick={() => setActiveCategory(null)}
              >
                Todos
                <span className={styles.categoryTabCount}>{products.length}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={activeCategory === cat}
                  className={`${styles.categoryTab} ${activeCategory === cat ? styles.categoryTabActive : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                  <span className={styles.categoryTabCount}>{categoryCounts.get(cat) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory pills */}
          {subcategoriesForActive.length > 0 && (
            <div className={styles.subcatScroll}>
              <div className={styles.subcatTrack} role="group" aria-label="Subcategorías">
                <button
                  type="button"
                  className={`${styles.subcatPill} ${activeSub === null ? styles.subcatPillActive : ''}`}
                  onClick={() => setActiveSub(null)}
                >
                  Todas
                </button>
                {subcategoriesForActive.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    className={`${styles.subcatPill} ${activeSub === sub ? styles.subcatPillActive : ''}`}
                    onClick={() => setActiveSub(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Product grid ───────────────────────────────────────── */}
      <main className={styles.productsSection}>
        {products.length === 0 ? (
          <div className={styles.empty}>
            <Package className={styles.emptyIcon} size={52} strokeWidth={1.25} aria-hidden="true" />
            <h2 className={styles.emptyTitle}>Catálogo en construcción</h2>
            <p className={styles.emptySubtitle}>Este negocio está preparando su vitrina digital.</p>
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
          <div className={styles.productsGrid}>
            {visible.map(p => (
              <article
                key={p.id}
                className={styles.productCard}
                onClick={() => openModal(p)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(p) }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalle: ${p.name}`}
              >
                {/* Image */}
                <div className={styles.productImageWrap}>
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className={styles.productImage}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`${styles.productImagePlaceholder} ${getCategoryClass(p.categoryName)}`}
                      aria-hidden="true"
                    >
                      <span className={styles.productInitial}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Status badge (top right) */}
                  {p.availability === 'discontinued' ? (
                    <div className={styles.badgeDiscontinued} aria-label="Descontinuado">
                      <span>
                        <Archive size={10} aria-hidden="true" />
                        &nbsp;Descontinuado
                      </span>
                    </div>
                  ) : p.catalogVisibility === 'on_request' ? (
                    <div className={styles.badgeOnRequest} aria-label="Bajo pedido">
                      Consultar
                    </div>
                  ) : (p.outOfStock || p.availability === 'out_of_stock') ? (
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

                  {/* Product badge (top left) */}
                  {p.catalogVisibility !== 'on_request' &&
                    !p.outOfStock &&
                    !p.isService &&
                    p.badge && p.badge !== 'none' &&
                    getBadgeClass(p.badge) && (
                    <span className={`${styles.productBadge} ${getBadgeClass(p.badge)}`}>
                      {BADGE_LABEL[p.badge]}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className={styles.productInfo}>
                  {p.categoryName && (
                    <p className={styles.productCategory}>{p.categoryName}</p>
                  )}
                  <h2 className={styles.productName}>{p.name}</h2>

                  <div className={styles.productPrice}>
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
              </article>
            ))}
          </div>
        )}
      </main>

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
                <div key={item.product_id} className={styles.drawerItem}>
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
                    <span className={styles.drawerItemPrice}>{fmtUsd(item.price_usd)} c/u</span>
                    <span className={styles.drawerItemPriceBs}>{fmtBs(item.price_usd * rate)} c/u</span>
                    <span className={styles.drawerItemSubtotal}>{fmtUsd(item.qty * item.price_usd)}</span>
                  </div>
                  <div className={styles.drawerQtyCtrl}>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, -1)}
                      aria-label={`Reducir cantidad de ${item.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className={styles.drawerQtyNum}>{item.qty}</span>
                    <button
                      type="button"
                      className={styles.drawerQtyBtn}
                      onClick={() => updateCartQty(item.product_id, 1)}
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
                  className={styles.checkoutInput}
                  value={cPhone}
                  onChange={e => setCPhone(e.target.value)}
                  placeholder="58XXXXXXXXXX"
                  disabled={submitting}
                />
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
            </div>
            <div className={styles.checkoutActions}>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleCheckout}
                disabled={submitting || !cName.trim() || !cPhone.trim() || (paymentMethods.length > 0 && !cPayment)}
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
                  src={selP.image}
                  alt={selP.name}
                  className={styles.modalImage}
                />
              ) : (
                <div
                  className={`${styles.modalImagePlaceholder} ${getCategoryClass(selP.categoryName)}`}
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
                    <span className={styles.modalPriceUsd}>
                      ${selP.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                    onClick={() => { addToCart(selP, modalQty); closeModal(); setCartOpen(true) }}
                  >
                    <ShoppingBag size={17} aria-hidden="true" />
                    Agregar · ${(selP.priceUsd * modalQty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
            </div>
          </div>
        </>
      )}
    </>
  )
}
