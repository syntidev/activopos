'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Package, X, MessageCircle, ShoppingBag, Plus, Minus, Search, CheckCircle, Star } from 'lucide-react'
import styles from './catalogo.module.css'

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
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const BADGE_LABEL: Record<string, string> = {
  popular:     'Popular',
  nuevo:       'Nuevo',
  promo:       'Promo',
  recomendado: 'Recomendado',
}

const FEATURED_KEY = '__destacados__'

function getBadgeClass(badge: string | null | undefined): string {
  switch (badge) {
    case 'popular':     return styles.badgePopular
    case 'nuevo':       return styles.badgeNuevo
    case 'promo':       return styles.badgePromo
    case 'recomendado': return styles.badgeRecomendado
    default:            return ''
  }
}

function getConsultarWaUrl(phone: string, productName: string): string {
  if (!phone) return '#'
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, quiero consultar disponibilidad de: ${productName}`)}`
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

export function CatalogoGrid({ products, categories, slug, rate, paymentMethods, businessPhone }: Props) {
  const [active,          setActive]          = useState<string | null>(null)
  const [activeSub,       setActiveSub]       = useState<string | null>(null)
  const [query,           setQuery]           = useState('')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [modalQty,        setModalQty]        = useState(1)
  const [cart,            setCart]            = useState<CartItem[]>([])
  const [cartOpen,        setCartOpen]        = useState(false)
  const [checkoutOpen,    setCheckoutOpen]    = useState(false)
  const [cName,           setCName]           = useState('')
  const [cPhone,          setCPhone]          = useState('')
  const [cRef,            setCRef]            = useState('')
  const [cPayment,        setCPayment]        = useState(paymentMethods[0]?.name ?? '')
  const [submitting,      setSubmitting]      = useState(false)
  const [submitted,       setSubmitted]       = useState(false)

  const closeRef  = useRef<HTMLButtonElement>(null)
  const nameRef   = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const hasFeatured = useMemo(() => products.some(p => p.isFeatured), [products])

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (p.categoryName) map.set(p.categoryName, (map.get(p.categoryName) ?? 0) + 1)
    }
    return map
  }, [products])

  const subcategoriesForActive = useMemo(() => {
    if (!active || active === FEATURED_KEY) return []
    const subs = new Set<string>()
    for (const p of products) {
      if (p.categoryName === active && p.subcategory) subs.add(p.subcategory)
    }
    return Array.from(subs).sort()
  }, [products, active])

  // Reset subcategory when main category changes
  useEffect(() => { setActiveSub(null) }, [active])

  const visible = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return products.filter(p =>
        p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
        (p.categoryName?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '').includes(q),
      )
    }
    if (active === FEATURED_KEY) return products.filter(p => p.isFeatured)
    const byCat = active ? products.filter(p => p.categoryName === active) : products
    return activeSub ? byCat.filter(p => p.subcategory === activeSub) : byCat
  }, [products, query, active, activeSub])

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

  // Escape key: close top layer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (checkoutOpen && !submitting) { setCheckoutOpen(false); return }
      if (selectedProduct)             { closeModal(); return }
      if (cartOpen)                    { setCartOpen(false) }
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
    } catch { /* noop — user stays in form */ }
    finally { setSubmitting(false) }
  }

  const selP = selectedProduct

  return (
    <>
      {/* ── Toolbar: search + cart ─────────────────────────────── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => { setQuery(''); searchRef.current?.focus() }}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.cartBtn}
            onClick={() => setCartOpen(true)}
            aria-label={`Carrito — ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`}
          >
            <ShoppingBag size={18} aria-hidden="true" />
            {totalItems > 0 && (
              <span key={totalItems} className={styles.cartBadge} aria-hidden="true">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Category tabs (mobile, hidden while searching) ──────── */}
      {!query && (
        <div className={styles.tabsWrapperMobile}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por categoría">
            {hasFeatured && (
              <button
                role="tab"
                aria-selected={active === FEATURED_KEY}
                className={`${styles.tab} ${active === FEATURED_KEY ? styles.tabActive : ''}`}
                onClick={() => setActive(FEATURED_KEY)}
              >
                <Star size={14} aria-hidden="true" className={styles.tabIcon} /> Destacados
              </button>
            )}
            <button
              role="tab"
              aria-selected={active === null}
              className={`${styles.tab} ${active === null ? styles.tabActive : ''}`}
              onClick={() => setActive(null)}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                role="tab"
                aria-selected={active === cat}
                className={`${styles.tab} ${active === cat ? styles.tabActive : ''}`}
                onClick={() => setActive(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Subcategory pills — appear when a real category is selected and has subs */}
          {subcategoriesForActive.length > 0 && (
            <div className={styles.subcatPills} role="group" aria-label="Subcategorías">
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
          )}
        </div>
      )}

      {/* ── Content layout ──────────────────────────────────────── */}
      <div className={styles.contentLayout}>

        {/* Desktop sidebar (hidden while searching) */}
        {!query && (
          <aside className={styles.sidebar} aria-label="Categorías">
            <p className={styles.sidebarTitle}>Categorías</p>
            <nav>
              {hasFeatured && (
                <button
                  className={`${styles.categoryItem} ${active === FEATURED_KEY ? styles.categoryItemActive : ''}`}
                  onClick={() => setActive(FEATURED_KEY)}
                >
                  <span className={styles.categoryName}><Star size={14} aria-hidden="true" className={styles.categoryIcon} /> Destacados</span>
                  <span className={styles.categoryCount}>{products.filter(p => p.isFeatured).length}</span>
                </button>
              )}
              <button
                className={`${styles.categoryItem} ${active === null ? styles.categoryItemActive : ''}`}
                onClick={() => setActive(null)}
              >
                <span className={styles.categoryName}>Todos</span>
                <span className={styles.categoryCount}>{products.length}</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`${styles.categoryItem} ${active === cat ? styles.categoryItemActive : ''}`}
                  onClick={() => setActive(cat)}
                >
                  <span className={styles.categoryName}>{cat}</span>
                  <span className={styles.categoryCount}>{categoryCounts.get(cat) ?? 0}</span>
                </button>
              ))}
            </nav>
            {/* Subcategory second level */}
            {subcategoriesForActive.length > 0 && (
              <div className={styles.sidebarSubcats}>
                <p className={styles.sidebarSubcatsLabel}>Subcategorías</p>
                <button
                  type="button"
                  className={`${styles.subcatItem} ${activeSub === null ? styles.subcatItemActive : ''}`}
                  onClick={() => setActiveSub(null)}
                >
                  Todas
                </button>
                {subcategoriesForActive.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    className={`${styles.subcatItem} ${activeSub === sub ? styles.subcatItemActive : ''}`}
                    onClick={() => setActiveSub(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* Product grid */}
        <main className={styles.main}>
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
            <div className={styles.grid}>
              {visible.map(p => (
                <article
                  key={p.id}
                  className={styles.card}
                  onClick={() => openModal(p)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault(); openModal(p)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle: ${p.name}`}
                >
                  <div className={styles.cardImage}>
                    {p.image ? (
                      <img src={p.image} alt={p.name} className={styles.productImg} loading="lazy" />
                    ) : (
                      <div className={`${styles.noImage} ${getCategoryClass(p.categoryName)}`} aria-hidden="true">
                        <span className={styles.noImageInitial}>{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    {p.catalogVisibility === 'on_request' ? (
                      <span className={styles.badgeOnRequest}>Consultar</span>
                    ) : (p.outOfStock || p.availability === 'out_of_stock') ? (
                      <span className={styles.badgeSinStock}>Sin stock</span>
                    ) : p.availability === 'low_stock' ? (
                      <span className={styles.badgeLowStock}>Pocas unidades</span>
                    ) : p.isService ? (
                      <span className={styles.badgeDisponible}>Disponible</span>
                    ) : p.stockQty !== null && p.stockQty > 0 ? (
                      <span className={styles.badgeStock}>
                        {p.stockQty <= 5 ? `Últimas ${p.stockQty}` : `${p.stockQty} disponibles`}
                      </span>
                    ) : null}
                    {p.catalogVisibility !== 'on_request' && !p.outOfStock && !p.isService && p.badge && p.badge !== 'none' && getBadgeClass(p.badge) && (
                      <span className={`${styles.productBadge} ${getBadgeClass(p.badge)}`}>
                        {BADGE_LABEL[p.badge]}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    {p.categoryName && <span className={styles.category}>{p.categoryName}</span>}
                    <h2 className={styles.productName}>{p.name}</h2>
                    {p.description && <p className={styles.productDesc}>{p.description}</p>}
                    <div className={styles.priceRow}>
                      {p.catalogVisibility === 'on_request' ? (
                        <span className={styles.priceConsultar}>Consultar precio</span>
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
      </div>

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

          {/* Payment method badges */}
          {paymentMethods.length > 0 && (
            <div className={styles.drawerPayments}>
              <p className={styles.drawerPaymentsLabel}>Métodos de pago</p>
              <div className={styles.drawerPaymentBadges}>
                {paymentMethods.map(pm => (
                  <span key={pm.id} className={styles.drawerPaymentBadge}>{pm.name}</span>
                ))}
              </div>
            </div>
          )}

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

      {/* ── Checkout modal "Antes de enviar" ────────────────────── */}
      {checkoutOpen && (
        <div
          className={styles.checkoutOverlay}
          onClick={e => { if (e.target === e.currentTarget && !submitting) setCheckoutOpen(false) }}
        >
          <div className={styles.checkoutModal} role="dialog" aria-modal="true" aria-label="Antes de enviar">
            {submitted ? (
              <div className={styles.checkoutSuccess}>
                <div className={styles.successIcon}>
                  <CheckCircle size={32} aria-hidden="true" />
                </div>
                <h3 className={styles.successTitle}>¡Pedido enviado!</h3>
                <p className={styles.successSubtitle}>
                  WhatsApp se abrió con los detalles de tu pedido.<br />El negocio lo recibirá en breve.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Product detail modal ────────────────────────────────── */}
      {selP && (
        <div
          className={styles.productModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle: ${selP.name}`}
          onClick={closeModal}
        >
          <div className={styles.productModal} onClick={e => e.stopPropagation()}>
            <div className={styles.productModalImg}>
              {selP.image ? (
                <img src={selP.image} alt={selP.name} className={styles.productModalImgEl} />
              ) : (
                <div
                  className={`${styles.productModalImgFallback} ${getCategoryClass(selP.categoryName)}`}
                  aria-hidden="true"
                >
                  <span className={styles.productModalImgInitial}>{selP.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {selP.catalogVisibility === 'on_request' ? (
                <span className={`${styles.badgeOnRequest} ${styles.badgeModal}`}>Consultar</span>
              ) : (selP.outOfStock || selP.availability === 'out_of_stock') ? (
                <span className={`${styles.badgeSinStock} ${styles.badgeModal}`}>Sin stock</span>
              ) : selP.availability === 'low_stock' ? (
                <span className={`${styles.badgeLowStock} ${styles.badgeModal}`}>Pocas unidades</span>
              ) : null}
              <button
                ref={closeRef}
                type="button"
                className={styles.productModalClose}
                onClick={closeModal}
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.productModalBody}>
              {selP.categoryName && <span className={styles.category}>{selP.categoryName}</span>}
              <h3 className={styles.productModalName}>{selP.name}</h3>
              {selP.description && <p className={styles.productModalDesc}>{selP.description}</p>}
              <div className={styles.productModalPrices}>
                {selP.catalogVisibility === 'on_request' ? (
                  <span className={styles.priceConsultar}>Consultar precio</span>
                ) : selP.priceUsd > 0 ? (
                  <>
                    <span className={styles.priceUsd}>
                      ${selP.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    {selP.priceBs && (
                      <span className={styles.priceBs}>
                        Bs.&nbsp;{selP.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.priceConsultar}>Consultar precio</span>
                )}
              </div>

              {selP.catalogVisibility === 'on_request' ? (
                <div className={styles.productModalCtas}>
                  <a
                    href={getConsultarWaUrl(businessPhone, selP.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.waOrangeBtn}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Consultar disponibilidad
                  </a>
                </div>
              ) : selP.priceUsd > 0 && (
                <>
                  <div className={styles.productModalQtyRow}>
                    <span className={styles.productModalQtyLabel}>Cantidad</span>
                    <div className={styles.productModalQtyCtrl}>
                      <button
                        type="button"
                        className={styles.productModalQtyBtn}
                        onClick={() => setModalQty(q => Math.max(1, q - 1))}
                        disabled={modalQty <= 1}
                        aria-label="Reducir cantidad"
                      >
                        <Minus size={14} />
                      </button>
                      <span className={styles.productModalQtyNum}>{modalQty}</span>
                      <button
                        type="button"
                        className={styles.productModalQtyBtn}
                        onClick={() => setModalQty(q => q + 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.productModalCtas}>
                    <button
                      type="button"
                      className={styles.addToCartBtn}
                      disabled={selP.outOfStock}
                      onClick={() => {
                        addToCart(selP, modalQty)
                        closeModal()
                        setCartOpen(true)
                      }}
                    >
                      <ShoppingBag size={16} aria-hidden="true" />
                      {selP.outOfStock ? 'Sin stock' : 'Agregar al carrito'}
                    </button>
                    <button
                      type="button"
                      className={styles.waOrangeBtn}
                      disabled={selP.outOfStock}
                      onClick={() => {
                        addToCart(selP, modalQty)
                        closeModal()
                        setCartOpen(true)
                        setCheckoutOpen(true)
                      }}
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      Pedir por WhatsApp
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
