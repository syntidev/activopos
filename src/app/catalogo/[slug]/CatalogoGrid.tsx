'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
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
}

function getCategoryClass(categoryName: string | null | undefined): string {
  if (!categoryName) return styles.gradDefault
  // Strip combining diacritical marks (e.g. "Tecnología" → "tecnologia")
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

export function CatalogoGrid({ products, categories }: Props) {
  const [active, setActive] = useState<string | null>(null)

  const visible = active
    ? products.filter(p => p.categoryName === active)
    : products

  return (
    <>
      {/* ── Tabs ──────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className={styles.tabsWrapper}>
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

      {/* ── Grid ──────────────────────────────────────────────── */}
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
              <article key={p.id} className={styles.card}>
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
    </>
  )
}
