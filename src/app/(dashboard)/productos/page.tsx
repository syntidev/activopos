'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  Search,
  Tag,
  Upload,
  Package,
  Edit2,
  Trash2,
  SlidersHorizontal,
  BarChart2,
  FileDown,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react'
import { ProductModal } from '@/components/products/ProductModal'
import { CategoryModal } from '@/components/products/CategoryModal'
import { ImportModal } from '@/components/products/ImportModal'
import { StockModal } from '@/components/products/StockModal'
import type { ProductFormData, ModalCategory, EditableProduct } from '@/components/products/ProductModal'
import styles from './productos.module.css'

/* ── Types ── */

interface Category {
  id: number
  name: string
  color: string
}

interface Product {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  sale_mode: 'unit' | 'weight' | 'service'
  price_per_unit_usd: number
  cost_per_unit_usd: number | null
  stock_quantity: number
  min_stock: number | null
  category: Category | null
  category_id: number | null
  image_path?: string | null
  is_available?: boolean
  has_variants?: boolean
}

/* ── Helpers ── */

function getStockLevel(qty: number, minStock: number | null): 'ok' | 'low' | 'out' {
  if (qty <= 0) return 'out'
  if (minStock !== null && qty <= minStock) return 'low'
  if (qty <= 5) return 'low'
  return 'ok'
}

function fmtUsd(n: number | null | undefined): string {
  return (
    '$' +
    (n ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function fmtBs(n: number, rate: number): string {
  if (!rate) return '—'
  return (
    'Bs. ' +
    (n * rate).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

const CAT_BADGE: Record<string, string> = {
  blue:   styles.catBlue,
  green:  styles.catGreen,
  orange: styles.catOrange,
  red:    styles.catRed,
  violet: styles.catViolet,
  pink:   styles.catPink,
  cyan:   styles.catCyan,
  gray:   styles.catGray,
}

const SALE_MODE_LABEL: Record<Product['sale_mode'], string> = {
  unit:    'Unidad',
  weight:  'Kg',
  service: 'Servicio',
}

/* ── Skeleton rows ── */
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className={styles.tr}>
          <td className={styles.td}>
            <div className={`${styles.skeleton} ${styles.skeletonName}`} />
            <div className={`${styles.skeleton} ${styles.skeletonMeta}`} />
          </td>
          <td className={styles.td}>
            <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
          </td>
          <td className={styles.td}>
            <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
          </td>
          <td className={styles.td}>
            <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
          </td>
          <td className={styles.td}>
            <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
          </td>
          <td className={styles.td} />
        </tr>
      ))}
    </>
  )
}

/* ── Main page ── */

export default function ProductosPage() {
  const [products, setProducts]           = useState<Product[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [isLoading, setIsLoading]         = useState(true)
  const [bcvRate, setBcvRate]             = useState(0)
  const [search, setSearch]               = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  /* ── Modal states ── */
  const [showProductModal, setShowProductModal] = useState(false)
  const [editProduct, setEditProduct]     = useState<EditableProduct | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [stockProduct, setStockProduct]   = useState<Product | null>(null)

  /* ── Debounced search ── */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  /* ── Data fetching ── */
  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch)  params.set('search', debouncedSearch)
      if (selectedCategory) params.set('categoryId', selectedCategory)

      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.products ?? [])
      }
    } catch {
      // Keep current list on network error
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, selectedCategory])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/products/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories ?? [])
      }
    } catch {
      // Ignore
    }
  }, [])

  const fetchBcvRate = useCallback(async () => {
    try {
      const res = await fetch('/api/rates/bcv')
      if (res.ok) {
        const data = await res.json()
        if (data.rate) setBcvRate(Number(data.rate))
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchBcvRate()
  }, [fetchCategories, fetchBcvRate])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  /* ── CRUD handlers ── */

  const handleSaveProduct = useCallback(async (data: ProductFormData) => {
    const isEdit = !!editProduct
    const url    = isEdit ? `/api/products/${editProduct!.id}` : '/api/products'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:               data.name,
        barcode:            data.barcode || null,
        sale_mode:          data.saleMode,
        category_id:        data.categoryId,
        cost_per_unit_usd:  data.costPerUnitUsd,
        price_per_unit_usd: data.pricePerUnitUsd,
        is_available:       data.isAvailable,
        catalog_visible:    data.catalogVisible,
        has_variants:       data.hasVariants,
        images:             data.images,
        ...(isEdit ? {} : { stock_quantity: data.stockInitial }),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }

    setShowProductModal(false)
    setEditProduct(null)
    await fetchProducts()
    if (!isEdit) await fetchCategories()
  }, [editProduct, fetchProducts, fetchCategories])

  const handleDeleteProduct = useCallback(async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return

    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id))
      }
    } catch {
      // Ignore
    }
  }, [])

  const handleSaveCategory = useCallback(async (name: string, color: string) => {
    const res = await fetch('/api/products/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    await fetchCategories()
  }, [fetchCategories])

  const handleSaveStock = useCallback(async (
    productId: number,
    type: 'entry' | 'adjust',
    quantity: number,
    costPerUnit: number | null,
    supplier: string,
    notes: string,
  ) => {
    const res = await fetch(`/api/products/${productId}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, quantity, cost_per_unit: costPerUnit, supplier, notes }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    setStockProduct(null)
    await fetchProducts()
  }, [fetchProducts])

  /* ── Open edit modal ── */
  const handleToggleAvailable = useCallback(async (product: Product) => {
    const next = !(product.is_available ?? true)
    try {
      await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: next }),
      })
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, is_available: next } : p
      ))
    } catch {
      // Keep current state on error
    }
  }, [])

  const openEdit = useCallback((product: Product) => {
    setEditProduct({
      id:                 product.id,
      name:               product.name,
      barcode:            product.barcode,
      sale_mode:          product.sale_mode,
      category_id:        product.category_id,
      cost_per_unit_usd:  product.cost_per_unit_usd,
      price_per_unit_usd: product.price_per_unit_usd,
      is_available:       product.is_available,
      has_variants:       product.has_variants,
    })
    setShowProductModal(true)
  }, [])

  /* ── Render ── */

  const modalCategories: ModalCategory[] = categories

  return (
    <div className={styles.page}>
      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h2 className={styles.pageTitle}>Inventario y Productos</h2>
          <p className={styles.pageSub}>
            Gestiona tu catálogo, precios, categorías y códigos de barra.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnAction}
            onClick={() => {/* TODO: reports */}}
            aria-label="Ver reportes de productos"
          >
            <BarChart2 size={15} aria-hidden="true" />
            Reporte
          </button>

          <button
            type="button"
            className={styles.btnAction}
            aria-label="Imprimir etiquetas"
          >
            <Tag size={15} aria-hidden="true" />
            Etiquetas
          </button>

          <button
            type="button"
            className={styles.btnAction}
            onClick={() => setShowImportModal(true)}
            aria-label="Importar productos desde Excel"
          >
            <Upload size={15} aria-hidden="true" />
            Migración
          </button>

          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.btnPrimaryAction}`}
            onClick={() => { setEditProduct(null); setShowProductModal(true) }}
            aria-label="Crear nuevo producto"
          >
            <Plus size={16} aria-hidden="true" />
            Nuevo
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar producto por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar productos"
          />
        </div>

        {!isLoading && products.length > 0 && (
          <span className={styles.countInfo}>
            {products.length} {products.length === 1 ? 'producto' : 'productos'}
          </span>
        )}
      </div>

      {/* ── Category tabs ── */}
      {categories.length > 0 && (
        <div className={styles.tabsBar} role="tablist" aria-label="Filtrar por categoría">
          <button
            role="tab"
            type="button"
            className={`${styles.catTab} ${selectedCategory === '' ? styles.catTabActive : ''}`}
            onClick={() => setSelectedCategory('')}
            aria-selected={selectedCategory === ''}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              type="button"
              className={`${styles.catTab} ${selectedCategory === String(cat.id) ? styles.catTabActive : ''}`}
              onClick={() => setSelectedCategory(String(cat.id))}
              aria-selected={selectedCategory === String(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-label="Lista de productos">
            <thead>
              <tr>
                <th className={styles.th}>Producto</th>
                <th className={styles.th}>Precio (REF)</th>
                <th className={styles.th}>Precio (Bs)</th>
                <th className={styles.th}>Stock</th>
                <th className={styles.th}>Utilidad</th>
                <th className={`${styles.th} ${styles.tdCenter}`}>
                  <Eye size={14} aria-hidden="true" />
                </th>
                <th className={`${styles.th} ${styles.tdRight}`}>
                  <SlidersHorizontal size={14} aria-hidden="true" />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton />
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>
                        <Package size={24} aria-hidden="true" />
                      </div>
                      <p className={styles.emptyTitle}>
                        {debouncedSearch || selectedCategory
                          ? 'Sin resultados para esta búsqueda'
                          : 'No hay productos todavía'}
                      </p>
                      <p className={styles.emptySub}>
                        {debouncedSearch || selectedCategory
                          ? 'Intenta con otro término o cambia el filtro de categoría.'
                          : 'Crea tu primer producto para comenzar a vender.'}
                      </p>
                      {!debouncedSearch && !selectedCategory && (
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => { setEditProduct(null); setShowProductModal(true) }}
                        >
                          <Plus size={15} aria-hidden="true" />
                          Nuevo Producto
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const stockLevel = product.sale_mode === 'service'
                    ? null
                    : getStockLevel(product.stock_quantity, product.min_stock)

                  const utility = product.cost_per_unit_usd !== null
                    ? product.price_per_unit_usd - product.cost_per_unit_usd
                    : null

                  const catBadgeClass = product.category
                    ? CAT_BADGE[product.category.color] ?? styles.catGray
                    : null

                  return (
                    <tr
                      key={product.id}
                      className={`${styles.tr} ${(product.is_available === false) ? styles.trUnavailable : ''}`}
                    >
                      {/* PRODUCTO */}
                      <td className={styles.td}>
                        <div className={styles.productCell}>
                          {product.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_path}
                              alt={product.name}
                              className={styles.productThumb}
                            />
                          ) : (
                            <div className={styles.productThumbEmpty}>
                              <Package size={14} aria-hidden="true" />
                            </div>
                          )}
                          <div className={styles.productInfo}>
                            <span className={styles.productName}>{product.name}</span>
                            <div className={styles.productMeta}>
                              {product.category && catBadgeClass && (
                                <span className={`${styles.categoryBadge} ${catBadgeClass}`}>
                                  {product.category.name}
                                </span>
                              )}
                              <span className={styles.saleModeTag}>
                                {SALE_MODE_LABEL[product.sale_mode]}
                              </span>
                              {product.has_variants && (
                                <span className={styles.variantBadge}>
                                  <Layers size={10} aria-hidden="true" />
                                  Variantes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* PRECIO REF */}
                      <td className={styles.td}>
                        <span className={styles.priceRef}>
                          {fmtUsd(product.price_per_unit_usd)}
                        </span>
                      </td>

                      {/* PRECIO BS */}
                      <td className={styles.td}>
                        <span className={styles.priceBs}>
                          {fmtBs(product.price_per_unit_usd, bcvRate)}
                        </span>
                      </td>

                      {/* STOCK */}
                      <td className={styles.td}>
                        {stockLevel === null ? (
                          <span className={styles.stockNone}>—</span>
                        ) : stockLevel === 'out' ? (
                          <span className={`${styles.stockBadge} ${styles.stockOut}`}>
                            Agotado
                          </span>
                        ) : (
                          <span
                            className={`${styles.stockBadge} ${
                              stockLevel === 'low' ? styles.stockLow : styles.stockOk
                            }`}
                          >
                            {product.stock_quantity}
                            {product.sale_mode === 'weight' ? ' kg' : ' und'}
                          </span>
                        )}
                      </td>

                      {/* UTILIDAD */}
                      <td className={styles.td}>
                        {utility === null ? (
                          <span className={styles.utilityZero}>—</span>
                        ) : (
                          <span
                            className={
                              utility > 0
                                ? styles.utilityPos
                                : utility < 0
                                  ? styles.utilityNeg
                                  : styles.utilityZero
                            }
                          >
                            {fmtUsd(utility)}
                          </span>
                        )}
                      </td>

                      {/* DISPONIBLE */}
                      <td className={`${styles.td} ${styles.tdCenter}`}>
                        <button
                          type="button"
                          className={`${styles.rowActionBtn} ${(product.is_available === false) ? styles.rowActionOff : ''}`}
                          title={product.is_available === false ? 'Activar producto' : 'Desactivar producto'}
                          aria-label={product.is_available === false ? `Activar ${product.name}` : `Desactivar ${product.name}`}
                          onClick={() => handleToggleAvailable(product)}
                        >
                          {product.is_available === false
                            ? <EyeOff size={15} aria-hidden="true" />
                            : <Eye size={15} aria-hidden="true" />}
                        </button>
                      </td>

                      {/* ACCIONES */}
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        <div className={styles.rowActions} role="group" aria-label={`Acciones: ${product.name}`}>
                          <button
                            type="button"
                            className={styles.rowActionBtn}
                            title="Imprimir etiqueta"
                            aria-label={`Imprimir etiqueta de ${product.name}`}
                          >
                            <FileDown size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.rowActionBtn}
                            title="Ajustar stock"
                            aria-label={`Ajustar stock de ${product.name}`}
                            onClick={() => setStockProduct(product)}
                            disabled={product.sale_mode === 'service'}
                          >
                            <Package size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.rowActionBtn}
                            title="Editar producto"
                            aria-label={`Editar ${product.name}`}
                            onClick={() => openEdit(product)}
                          >
                            <Edit2 size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${styles.rowActionDanger}`}
                            title="Eliminar producto"
                            aria-label={`Eliminar ${product.name}`}
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <ProductModal
        isOpen={showProductModal}
        editProduct={editProduct}
        categories={modalCategories}
        onClose={() => { setShowProductModal(false); setEditProduct(null) }}
        onSave={handleSaveProduct}
        onNewCategory={() => setShowCategoryModal(true)}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchProducts}
      />

      <StockModal
        isOpen={!!stockProduct}
        product={
          stockProduct
            ? {
                id:               stockProduct.id,
                name:             stockProduct.name,
                stock_quantity:   stockProduct.stock_quantity,
                sale_mode:        stockProduct.sale_mode,
                cost_per_unit_usd: stockProduct.cost_per_unit_usd,
              }
            : null
        }
        onClose={() => setStockProduct(null)}
        onSave={handleSaveStock}
      />
    </div>
  )
}
