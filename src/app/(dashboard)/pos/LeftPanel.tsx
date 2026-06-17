'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Barcode, Camera, Search, LayoutGrid, List } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProductCard } from '@/components/pos/ProductCard'
import { ProductListRow } from '@/components/pos/ProductListRow'
import type { ProductForPOS } from '@/lib/pos'
import type { SaleMode } from '@/types/products'
import styles from './pos.module.css'

type ViewMode = 'grid' | 'list'

interface BrowseProduct extends ProductForPOS {
  category_name: string | null
}

/* ── API response normalizers ──────────────────────────────────────────────── */

interface ApiProduct {
  id: number
  name: string
  sale_mode: string
  base_unit_label: string
  price_per_unit_usd: number | null
  price_per_kg_usd: number | null
  cost_per_unit_usd: number | null
  image_path?: string | null
  images?: string[] | null
  is_favorite: boolean
  has_variants?: boolean
  stock: { net_qty: number }
  category?: { name: string } | null
}

function normalizeBrowse(p: ApiProduct): BrowseProduct {
  return {
    id:                 p.id,
    name:               p.name,
    sale_mode:          p.sale_mode as SaleMode,
    base_unit_label:    p.base_unit_label,
    price_per_unit_usd: p.price_per_unit_usd,
    price_per_kg_usd:   p.price_per_kg_usd,
    cost_per_unit_usd:  p.cost_per_unit_usd,
    image_path:         p.image_path ?? p.images?.[0] ?? null,
    is_favorite:        p.is_favorite,
    has_variants:       p.has_variants ?? false,
    stock:              p.stock,
    category_name:      p.category?.name ?? null,
  }
}

function normalizeRecent(p: ApiProduct): ProductForPOS {
  return {
    id:                 p.id,
    name:               p.name,
    sale_mode:          p.sale_mode as SaleMode,
    base_unit_label:    p.base_unit_label,
    price_per_unit_usd: p.price_per_unit_usd,
    price_per_kg_usd:   p.price_per_kg_usd,
    cost_per_unit_usd:  p.cost_per_unit_usd,
    image_path:         p.image_path ?? p.images?.[0] ?? null,
    is_favorite:        p.is_favorite,
    has_variants:       p.has_variants ?? false,
    stock:              p.stock,
  }
}

/* ── Props ─────────────────────────────────────────────────────────────────── */

interface LeftPanelProps {
  search: string
  onSearchChange: (v: string) => void
  isSearching: boolean
  results: ProductForPOS[]
  rate: number
  onProductClick: (p: ProductForPOS) => void
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function LeftPanel({
  search, onSearchChange, isSearching, results, rate, onProductClick,
}: LeftPanelProps) {

  /* ── View mode (localStorage) ── */
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    const saved = localStorage.getItem('pos_view')
    if (saved === 'grid' || saved === 'list') setViewMode(saved)
  }, [])

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('pos_view', mode)
  }, [])

  /* ── Browse products (all POS products, loaded once) ── */
  const [browseProducts, setBrowseProducts] = useState<BrowseProduct[]>([])
  const [browseLoading, setBrowseLoading]   = useState(true)

  useEffect(() => {
    setBrowseLoading(true)
    fetch('/api/products?available=true')
      .then(r => r.json())
      .then((data: { products?: ApiProduct[] }) => {
        setBrowseProducts((data.products ?? []).map(normalizeBrowse))
      })
      .catch(() => setBrowseProducts([]))
      .finally(() => setBrowseLoading(false))
  }, [])

  /* ── Recent products (from CLI-A endpoint) ── */
  const [recientes, setRecientes] = useState<ProductForPOS[]>([])

  useEffect(() => {
    fetch('/api/products/recent')
      .then(r => r.json())
      .then((data: { products?: ApiProduct[] }) => {
        setRecientes((data.products ?? []).map(normalizeRecent))
      })
      .catch(() => setRecientes([]))
  }, [])

  /* ── Category tabs ── */
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of browseProducts) {
      if (p.category_name && !seen.has(p.category_name)) {
        seen.add(p.category_name)
        result.push(p.category_name)
      }
    }
    return result.sort((a, b) => a.localeCompare(b, 'es'))
  }, [browseProducts])

  /* ── Filtered browse products ── */
  const filteredBrowse = useMemo(
    () => activeCategory
      ? browseProducts.filter(p => p.category_name === activeCategory)
      : browseProducts,
    [browseProducts, activeCategory],
  )

  const inSearchMode = search.trim().length > 0

  return (
    <div className={styles.leftPanel}>

      {/* ── Search bar + view toggle ── */}
      <div className={styles.searchBar}>
        <div className={styles.searchBarRow}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar producto o código..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              aria-label="Buscar producto"
            />
            {isSearching
              ? <span className={styles.searchSpinner} aria-hidden="true" />
              : (
                <button
                  className={styles.cameraBtn}
                  aria-label="Escanear código"
                  title="Próximamente"
                  type="button"
                >
                  <Camera size={18} aria-hidden="true" />
                </button>
              )
            }
          </div>

          {/* View mode toggle */}
          <div className={styles.viewToggle} role="group" aria-label="Vista de productos">
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
              onClick={() => handleViewChange('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Vista cuadrícula"
            >
              <LayoutGrid size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
              onClick={() => handleViewChange('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="Vista lista"
            >
              <List size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Browse-only sections (hidden during search) ── */}
      {!inSearchMode && (
        <>
          {/* Recientes */}
          {recientes.length > 0 && (
            <div className={styles.recentesSection}>
              <p className={styles.recentesLabel}>Recientes</p>
              <div className={styles.recentesScroll}>
                {recientes.map(p => (
                  <RecenteChip
                    key={p.id}
                    product={p}
                    rate={rate}
                    onAdd={onProductClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category tabs */}
          {categories.length > 0 && (
            <div
              className={styles.categoryTabs}
              role="tablist"
              aria-label="Filtrar por categoría"
            >
              <button
                type="button"
                role="tab"
                className={`${styles.categoryTab} ${activeCategory === null ? styles.categoryTabActive : ''}`}
                onClick={() => setActiveCategory(null)}
                aria-selected={activeCategory === null}
              >
                Todo
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  className={`${styles.categoryTab} ${activeCategory === cat ? styles.categoryTabActive : ''}`}
                  onClick={() => setActiveCategory(cat)}
                  aria-selected={activeCategory === cat}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Products area ── */}
      <div className={styles.resultsArea}>
        {inSearchMode ? (
          /* Search results */
          <>
            {!isSearching && results.length === 0 && <NoResults query={search} />}
            {results.length > 0 && (
              <ProductsView
                products={results}
                viewMode={viewMode}
                rate={rate}
                onAdd={onProductClick}
              />
            )}
          </>
        ) : (
          /* Browse mode */
          <>
            {browseLoading && <BrowseLoading />}
            {!browseLoading && browseProducts.length === 0 && <SearchEmpty />}
            {!browseLoading && browseProducts.length > 0 && (
              <ProductsView
                products={filteredBrowse}
                viewMode={viewMode}
                rate={rate}
                onAdd={onProductClick}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

interface ProductsViewProps {
  products: ProductForPOS[]
  viewMode: ViewMode
  rate: number
  onAdd: (p: ProductForPOS) => void
}

function ProductsView({ products, viewMode, rate, onAdd }: ProductsViewProps) {
  if (viewMode === 'list') {
    return (
      <div className={styles.productList}>
        <AnimatePresence mode="popLayout">
          {products.map(p => (
            <ProductListRow key={p.id} product={p} rate={rate} onAdd={onAdd} />
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className={styles.productGrid}>
      <AnimatePresence mode="popLayout">
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i < 20 ? i * 0.02 : 0, duration: 0.15 }}
          >
            <ProductCard product={p} rate={rate} onAdd={onAdd} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface RecenteChipProps {
  product: ProductForPOS
  rate: number
  onAdd: (p: ProductForPOS) => void
}

function RecenteChip({ product, rate, onAdd }: RecenteChipProps) {
  const price =
    product.sale_mode === 'weight'
      ? (product.price_per_kg_usd ?? 0)
      : (product.price_per_unit_usd ?? 0)

  const outOfStock = (product.stock?.net_qty ?? 0) <= 0

  return (
    <motion.button
      type="button"
      className={`${styles.recenteChip} ${outOfStock ? styles.recenteChipDisabled : ''}`}
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      whileTap={outOfStock ? {} : { scale: 0.95 }}
      transition={{ duration: 0.08 }}
      aria-label={`Agregar ${product.name} al ticket`}
    >
      <span className={styles.recenteChipName}>{product.name}</span>
      <span className={styles.recenteChipPrice}>${price.toFixed(2)}</span>
    </motion.button>
  )
}

function BrowseLoading() {
  return (
    <div className={styles.browseLoading}>
      <span className={styles.browseLoadingSpinner} aria-hidden="true" />
      <span className={styles.browseLoadingText}>Cargando productos…</span>
    </div>
  )
}

function SearchEmpty() {
  return (
    <div className={styles.searchEmpty}>
      <Barcode size={56} strokeWidth={1} aria-hidden="true" />
      <p className={styles.emptyTitle}>Escanea o escribe para buscar</p>
      <p className={styles.emptySubtitle}>Código de barras, nombre o referencia del producto</p>
    </div>
  )
}

function NoResults({ query }: { query: string }) {
  return (
    <div className={styles.searchEmpty}>
      <Search size={40} strokeWidth={1} aria-hidden="true" />
      <p className={styles.emptyTitle}>Sin resultados para &ldquo;{query}&rdquo;</p>
      <p className={styles.emptySubtitle}>Verifica el nombre o agrégalo en Productos</p>
    </div>
  )
}
