'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, X, MessageCircle } from 'lucide-react'
import styles from './catalogo.module.css'

export interface CatalogProduct {
  id:           number
  name:         string
  description:  string | null
  image:        string | null
  categoryName: string | null
  priceUsd:     number
  priceBs:      number | null
  outOfStock:   boolean
}

interface Props {
  products:   CatalogProduct[]
  categories: string[]
  waPhone?:   string
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

export function CatalogoGrid({ products, categories, waPhone }: Props) {
  const [active, setActive]                   = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const closeRef                              = useRef<HTMLButtonElement>(null)

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (p.categoryName) map.set(p.categoryName, (map.get(p.categoryName) ?? 0) + 1)
    }
    return map
  }, [products])

  const visible = active
    ? products.filter(p => p.categoryName === active)
    : products

  const openModal  = (p: CatalogProduct) => setSelectedProduct(p)
  const closeModal = ()                   => setSelectedProduct(null)

  useEffect(() => {
    if (!selectedProduct) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      clearTimeout(t)
    }
  }, [selectedProduct])

  const selP   = selectedProduct
  const waLink = selP && waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola, vi tu catálogo y me interesa "${selP.name}". ¿Está disponible?`)}`
    : null

  return (
    <>
      {/* Mobile: horizontal tabs (hidden ≥ 1024px) */}
      {categories.length > 0 && (
        <div className={styles.tabsWrapperMobile}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por categoría">
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
        </div>
      )}

      {/* Content layout: sidebar + grid */}
      <div className={styles.contentLayout}>

        {/* Desktop sidebar (hidden < 1024px) */}
        {categories.length > 0 && (
          <aside className={styles.sidebar} aria-label="Categorías">
            <p className={styles.sidebarTitle}>Categorías</p>
            <nav>
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
          </aside>
        )}

        {/* Product grid */}
        <main className={styles.main}>
          {products.length === 0 ? (
            <div className={styles.empty}>
              <Package
                className={styles.emptyIcon}
                size={52}
                strokeWidth={1.25}
                aria-hidden="true"
              />
              <h2 className={styles.emptyTitle}>Catálogo en construcción</h2>
              <p className={styles.emptySubtitle}>
                Este negocio está preparando su vitrina digital.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Sin productos en esta categoría</p>
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
                      e.preventDefault()
                      openModal(p)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle: ${p.name}`}
                >
                  <div className={styles.cardImage}>
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className={styles.productImg}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`${styles.noImage} ${getCategoryClass(p.categoryName)}`}
                        aria-hidden="true"
                      >
                        <span className={styles.noImageInitial}>
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {p.outOfStock && (
                      <span className={styles.badgeSinStock}>Sin stock</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    {p.categoryName && (
                      <span className={styles.category}>{p.categoryName}</span>
                    )}
                    <h2 className={styles.productName}>{p.name}</h2>
                    {p.description && (
                      <p className={styles.productDesc}>{p.description}</p>
                    )}
                    <div className={styles.priceRow}>
                      {p.priceUsd > 0 ? (
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

      {/* Product detail modal */}
      {selP && (
        <div
          className={styles.productModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle: ${selP.name}`}
          onClick={closeModal}
        >
          <div
            className={styles.productModal}
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            <div className={styles.productModalImg}>
              {selP.image ? (
                <img
                  src={selP.image}
                  alt={selP.name}
                  className={styles.productModalImgEl}
                />
              ) : (
                <div
                  className={`${styles.productModalImgFallback} ${getCategoryClass(selP.categoryName)}`}
                  aria-hidden="true"
                >
                  <span className={styles.productModalImgInitial}>
                    {selP.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {selP.outOfStock && (
                <span className={`${styles.badgeSinStock} ${styles.badgeModal}`}>
                  Sin stock
                </span>
              )}
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

            {/* Body */}
            <div className={styles.productModalBody}>
              {selP.categoryName && (
                <span className={styles.category}>{selP.categoryName}</span>
              )}
              <h3 className={styles.productModalName}>{selP.name}</h3>
              {selP.description && (
                <p className={styles.productModalDesc}>{selP.description}</p>
              )}
              <div className={styles.productModalPrices}>
                {selP.priceUsd > 0 ? (
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
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.waBtn}
                >
                  <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
                  Pedir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
