'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CatalogBrand } from './CatalogoGrid'
import styles from './catalogo.module.css'

// Adaptación del patrón "Storefront Collection Filter" (shadcn.io) a nuestro
// stack real (CSS Modules, sin Tailwind/shadcn -- ver nota de sprint: no se
// instaló ninguna librería nueva, solo se reprodujo la UX: precio + marca +
// categoría, aplicar/limpiar, drawer lateral).
interface PriceRange { min: number; max: number }

interface FilterPanelProps {
  open:               boolean
  onClose:            () => void
  categories:         string[]
  brands:             CatalogBrand[]
  selectedCategories: string[]
  selectedBrands:     string[]
  priceRange:         PriceRange | null
  onApply: (next: { categories: string[]; brands: string[]; priceRange: PriceRange | null }) => void
}

export function FilterPanel({
  open, onClose, categories, brands, selectedCategories, selectedBrands, priceRange, onApply,
}: FilterPanelProps) {
  const [draftCategories, setDraftCategories] = useState<string[]>(selectedCategories)
  const [draftBrands,     setDraftBrands]     = useState<string[]>(selectedBrands)
  const [draftMin,        setDraftMin]        = useState<string>(priceRange ? String(priceRange.min) : '')
  const [draftMax,        setDraftMax]        = useState<string>(priceRange ? String(priceRange.max) : '')

  // Reabrir el panel siempre arranca desde lo que ya está aplicado, no desde
  // el último borrador descartado con "Cancelar".
  useEffect(() => {
    if (!open) return
    setDraftCategories(selectedCategories)
    setDraftBrands(selectedBrands)
    setDraftMin(priceRange ? String(priceRange.min) : '')
    setDraftMax(priceRange ? String(priceRange.max) : '')
  }, [open, selectedCategories, selectedBrands, priceRange])

  if (!open) return null

  const toggleCategory = (cat: string) => {
    setDraftCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }
  const toggleBrand = (name: string) => {
    setDraftBrands(prev => prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name])
  }

  const handleApply = () => {
    const min = parseFloat(draftMin)
    const max = parseFloat(draftMax)
    const nextPrice = !isNaN(min) && !isNaN(max) && max > min ? { min, max } : null
    onApply({ categories: draftCategories, brands: draftBrands, priceRange: nextPrice })
  }

  const handleClear = () => {
    setDraftCategories([])
    setDraftBrands([])
    setDraftMin('')
    setDraftMax('')
    onApply({ categories: [], brands: [], priceRange: null })
  }

  return (
    <>
      <div className={styles.filterPanelOverlay} onClick={onClose} aria-hidden="true" />
      <aside className={styles.filterPanelDrawer} role="dialog" aria-modal="true" aria-label="Filtros">
        <div className={styles.filterPanelHeader}>
          <h2 className={styles.filterPanelTitle}>Filtros</h2>
          <button type="button" className={styles.filterPanelClose} onClick={onClose} aria-label="Cerrar filtros">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.filterPanelBody}>
          <section className={styles.filterSection}>
            <h3 className={styles.filterSectionTitle}>Precio (USD)</h3>
            <div className={styles.filterPriceInputs}>
              <input
                type="number"
                inputMode="decimal"
                className={styles.filterPriceInput}
                placeholder="Mín"
                value={draftMin}
                onChange={e => setDraftMin(e.target.value)}
                min={0}
                aria-label="Precio mínimo"
              />
              <span className={styles.filterPriceSep}>—</span>
              <input
                type="number"
                inputMode="decimal"
                className={styles.filterPriceInput}
                placeholder="Máx"
                value={draftMax}
                onChange={e => setDraftMax(e.target.value)}
                min={0}
                aria-label="Precio máximo"
              />
            </div>
          </section>

          {brands.length > 0 && (
            <section className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Marca</h3>
              <div className={styles.filterCheckboxList}>
                {brands.map(b => (
                  <label key={b.name} className={styles.filterCheckboxRow}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={draftBrands.includes(b.name)}
                      onChange={() => toggleBrand(b.name)}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              <p className={styles.filterSectionNote}>
                Coincide por nombre de producto -- puede no encontrar todo lo de esa marca.
              </p>
            </section>
          )}

          {categories.length > 0 && (
            <section className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Categoría</h3>
              <div className={styles.filterCheckboxList}>
                {categories.map(cat => (
                  <label key={cat} className={styles.filterCheckboxRow}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={draftCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={styles.filterPanelFooter}>
          <button type="button" className={styles.filterClearBtn} onClick={handleClear}>
            Limpiar
          </button>
          <button type="button" className={styles.filterApplyBtn} onClick={handleApply}>
            Aplicar filtros
          </button>
        </div>
      </aside>
    </>
  )
}
