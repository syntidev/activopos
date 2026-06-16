'use client'

import { Barcode, Camera, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProductCard } from '@/components/pos/ProductCard'
import type { ProductForPOS } from '@/lib/pos'
import styles from './pos.module.css'

interface LeftPanelProps {
  search: string
  onSearchChange: (v: string) => void
  isSearching: boolean
  results: ProductForPOS[]
  rate: number
  onProductClick: (p: ProductForPOS) => void
}

export function LeftPanel({
  search, onSearchChange, isSearching, results, rate, onProductClick,
}: LeftPanelProps) {
  return (
    <div className={styles.leftPanel}>
      <div className={styles.searchBar}>
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
      </div>

      <div className={styles.resultsArea}>
        {!search.trim() && <SearchEmpty />}
        {search.trim() && results.length === 0 && !isSearching && <NoResults query={search} />}
        {results.length > 0 && (
          <div className={styles.productGrid}>
            <AnimatePresence mode="popLayout">
              {results.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                >
                  <ProductCard product={product} rate={rate} onAdd={onProductClick} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
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
