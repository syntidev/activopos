'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { HelpButton } from '@/components/help/HelpButton'
import {
  Plus,
  Search,
  Upload,
  Package,
  Edit2,
  Trash2,
  SlidersHorizontal,
  Layers,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  AlertTriangle,
  ScanBarcode,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react'
import { useScanner } from '@/hooks/useScanner'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
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
  requires_preparation: boolean
  image_url?: string | null
}

interface Product {
  id: number
  name: string
  description: string | null
  sku: string | null
  barcode: string | null
  sale_mode: 'unit' | 'weight' | 'service'
  price_per_unit_usd: number
  cost_per_unit_usd: number | null
  wholesale_price_usd?: number | null
  wholesale_price_per_kg_usd?: number | null
  location?: string | null
  notes?: string | null
  stock_quantity: number
  min_stock: number | null
  category: Category | null
  category_id: number | null
  image_path?: string | null
  is_available?: boolean
  has_variants?: boolean
  show_in_catalog?: boolean
  catalog_visibility?: 'visible' | 'on_request' | 'hidden'
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  images?: string[] | null
  badge?: string | null
  subcategory?: string | null
  is_featured?: boolean
  product_type?: 'simple' | 'combo' | 'fabricable'
  unit_type?: 'unit' | 'weight' | 'volume' | 'length'
  unit_label?: string
  unit_step?: number
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
  const router = useRouter()
  const { toast } = useToast()
  const [products, setProducts]           = useState<Product[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [isLoading, setIsLoading]         = useState(true)
  const [bcvRate, setBcvRate]             = useState(0)
  const [search, setSearch]               = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  /* ── Modal states ── */
  const [showProductModal, setShowProductModal] = useState(false)
  const [hasCatalogPlan, setHasCatalogPlan] = useState(false)

  useEffect(() => {
    fetch('/api/plan/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'access_catalog' }),
    })
      .then(res => res.json())
      .then(data => setHasCatalogPlan(!!data.allowed))
      .catch(() => {})
  }, [])
  const [editProduct, setEditProduct]     = useState<EditableProduct | null>(null)
  const [showCategoryModal, setShowCategoryModal]   = useState(false)
  const [editCategoryData, setEditCategoryData]     = useState<Category | null>(null)
  const [reorderMode, setReorderMode]               = useState(false)
  const [reordering, setReordering]                 = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [stockProduct, setStockProduct]   = useState<Product | null>(null)

  /* ── Mobile barcode scanner state (hook wired after openEdit) ── */
  const [scannerActive, setScannerActive] = useState(false)
  const [isScanning, setIsScanning]       = useState(false)
  const [scanToast, setScanToast]         = useState<string | null>(null)

  /* ── Status filter ── */
  type StatusFilter = 'all' | 'active' | 'inactive'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  /* ── Sort state (FIX 4) ── */
  type ProdSortKey = 'name' | 'price' | 'stock' | 'utility' | 'category'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<ProdSortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: ProdSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  /* ── Delete modal state (FIX 2) ── */
  type DeletePhase = 'confirm' | 'has_history'
  interface DeleteModal { product: Product; phase: DeletePhase; saving: boolean }
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null)

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
      if (selectedCategory) params.set('category_id', selectedCategory)

      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        // API devuelve stock como objeto { net_qty }; la UI lee stock_quantity (number)
        const list: Product[] = (data.products ?? []).map(
          (p: Product & { stock?: { net_qty?: number } }) => ({
            ...p,
            stock_quantity: p.stock?.net_qty ?? 0,
          })
        )
        setProducts(list)
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
        description:        data.description ?? null,
        barcode:            data.barcode || null,
        sale_mode:          data.saleMode,
        product_type:       data.productType,
        unit_type:          data.unitType,
        unit_label:         data.unitLabel,
        unit_step:          data.unitStep,
        components:         data.components,
        category_id:        data.categoryId,
        cost_per_unit_usd:  data.costPerUnitUsd,
        price_per_unit_usd: data.pricePerUnitUsd,
        wholesale_price_usd:        data.wholesalePriceUsd,
        wholesale_price_per_kg_usd: data.wholesalePricePerKgUsd,
        location:           data.location || null,
        notes:              data.notes || null,
        is_available:       data.isAvailable,
        catalog_visibility: data.catalogVisibility,
        availability:       data.availability,
        show_in_catalog:    data.catalogVisibility !== 'hidden',
        has_variants:       data.hasVariants,
        images:             data.images,
        badge:              data.badge || 'none',
        subcategory:        data.subcategory || null,
        is_featured:        data.isFeatured,
        ...(isEdit ? {} : {
          stock_quantity: data.stockInitial,
          variants: data.hasVariants
            ? data.variants.map(v => ({
                tipo:         'personalizado' as const,
                valor:        v.name,
                precio_extra: v.price_extra_usd,
                stock:        v.stock,
              }))
            : undefined,
        }),
        stock_alert_threshold: data.stockAlertThreshold,
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

  /* ── Delete handlers (FIX 2) ── */
  const handleDeleteClick = useCallback((product: Product) => {
    setDeleteModal({ product, phase: 'confirm', saving: false })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModal) return
    setDeleteModal(m => m ? { ...m, saving: true } : null)
    try {
      const res = await fetch(`/api/products/${deleteModal.product.id}`, { method: 'DELETE' })
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== deleteModal.product.id))
        setDeleteModal(null)
      } else if (res.status === 409) {
        setDeleteModal(m => m ? { ...m, phase: 'has_history', saving: false } : null)
      } else {
        setDeleteModal(m => m ? { ...m, saving: false } : null)
      }
    } catch {
      setDeleteModal(m => m ? { ...m, saving: false } : null)
    }
  }, [deleteModal])

  const handleDeactivateProduct = useCallback(async () => {
    if (!deleteModal) return
    setDeleteModal(m => m ? { ...m, saving: true } : null)
    try {
      await fetch(`/api/products/${deleteModal.product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: false }),
      })
      setProducts(prev => prev.map(p =>
        p.id === deleteModal.product.id ? { ...p, is_available: false } : p
      ))
      setDeleteModal(null)
    } catch {
      setDeleteModal(m => m ? { ...m, saving: false } : null)
    }
  }, [deleteModal])

  const handleForceDelete = useCallback(async () => {
    if (!deleteModal) return
    setDeleteModal(m => m ? { ...m, saving: true } : null)
    try {
      const res = await fetch(`/api/products/${deleteModal.product.id}?force=true`, { method: 'DELETE' })
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== deleteModal.product.id))
        setDeleteModal(null)
      } else {
        setDeleteModal(m => m ? { ...m, saving: false } : null)
      }
    } catch {
      setDeleteModal(m => m ? { ...m, saving: false } : null)
    }
  }, [deleteModal])

  /* ── Display list: filter + sort (FIX 3 + FIX 4) ── */
  const displayProducts = useMemo(() => {
    let list = products
    if (statusFilter === 'active')   list = list.filter(p => p.is_available !== false)
    if (statusFilter === 'inactive') list = list.filter(p => p.is_available === false)
    if (!sortKey) return list
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')     cmp = a.name.localeCompare(b.name)
      if (sortKey === 'price')    cmp = a.price_per_unit_usd - b.price_per_unit_usd
      if (sortKey === 'stock')    cmp = a.stock_quantity - b.stock_quantity
      if (sortKey === 'utility') {
        const ua = a.cost_per_unit_usd !== null ? a.price_per_unit_usd - a.cost_per_unit_usd : -Infinity
        const ub = b.cost_per_unit_usd !== null ? b.price_per_unit_usd - b.cost_per_unit_usd : -Infinity
        cmp = ua - ub
      }
      if (sortKey === 'category') cmp = (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [products, statusFilter, sortKey, sortDir])

  /* ── KPIs de inventario (inversión / estimado de venta) ── */
  const kpis = useMemo(() => {
    let inversion = 0
    let estimadoVenta = 0
    products.forEach(p => {
      const cost  = Number(p.cost_per_unit_usd ?? 0)
      const price = Number(p.price_per_unit_usd ?? 0)
      const stock = Number(p.stock_quantity ?? 0)
      if (stock > 0) {
        inversion     += cost * stock
        estimadoVenta += price * stock
      }
    })
    const utilidadEstimada = estimadoVenta - inversion
    return {
      inversion,
      estimadoVenta,
      utilidadEstimada,
      margen: estimadoVenta > 0 ? (utilidadEstimada / estimadoVenta) * 100 : 0,
    }
  }, [products])

  const handleSaveCategory = useCallback(async (name: string, color: string, requiresPreparation: boolean, imageUrl: string | null) => {
    const id     = editCategoryData?.id
    const url    = id ? `/api/categories/${id}` : '/api/products/categories'
    const method = id ? 'PATCH' : 'POST'
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, requires_preparation: requiresPreparation, image_url: imageUrl }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    setEditCategoryData(null)
    await fetchCategories()
  }, [editCategoryData, fetchCategories])

  const handleDeleteCategory = useCallback(async (cat: Category) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (res.ok && j.ok) {
      toast('Categoría eliminada', 'success')
      if (selectedCategory === String(cat.id)) setSelectedCategory('')
      await fetchCategories()
    } else {
      toast(j.error ?? 'Error al eliminar', 'error')
    }
  }, [selectedCategory, fetchCategories, toast])

  // Reordena categorías: mueve una posición y persiste sort_order = índice en todas.
  // El catálogo y estos tabs leen sort_order, así que el orden se refleja en la portada.
  const moveCategory = useCallback(async (index: number, dir: 'left' | 'right') => {
    const j = dir === 'left' ? index - 1 : index + 1
    if (j < 0 || j >= categories.length || reordering) return

    const next = [...categories]
    const tmp = next[index]
    next[index] = next[j]
    next[j] = tmp
    setCategories(next) // optimista

    setReordering(true)
    try {
      await Promise.all(next.map((c, i) =>
        fetch(`/api/categories/${c.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sort_order: i }),
        }),
      ))
      await fetchCategories()
    } finally {
      setReordering(false)
    }
  }, [categories, reordering, fetchCategories])

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
      description:        product.description,
      barcode:            product.barcode,
      sale_mode:          product.sale_mode,
      category_id:        product.category_id,
      cost_per_unit_usd:  product.cost_per_unit_usd,
      price_per_unit_usd: product.price_per_unit_usd,
      wholesale_price_usd:        product.wholesale_price_usd,
      wholesale_price_per_kg_usd: product.wholesale_price_per_kg_usd,
      location:           product.location,
      notes:              product.notes,
      is_available:       product.is_available,
      catalog_visibility: product.catalog_visibility,
      availability:       product.availability,
      has_variants:       product.has_variants,
      images:             product.images ?? [],
      badge:              product.badge,
      subcategory:        product.subcategory,
      is_featured:        product.is_featured,
      product_type:       product.product_type,
      unit_type:          product.unit_type,
      unit_label:         product.unit_label,
      unit_step:          product.unit_step,
    })
    setShowProductModal(true)
  }, [])

  /* ── Mobile scanner: wired here so openEdit is in scope ── */
  const handleProductScan = useCallback((barcode: string) => {
    const found = products.find(p => p.barcode === barcode)
    if (found) {
      setScannerActive(false)
      openEdit(found)
    } else {
      setScanToast('Producto no encontrado')
      setTimeout(() => setScanToast(null), 1500)
    }
  }, [products, openEdit])

  const { videoContainerRef: scanVideoRef, permError: scanPermError } = useScanner({
    active:   scannerActive,
    onResult: handleProductScan,
  })

  const { videoContainerRef: searchVideoRef } = useScanner({
    active:   isScanning,
    onResult: (code) => { setSearch(code); setIsScanning(false) },
  })

  /* ── Render ── */

  const modalCategories: ModalCategory[] = categories

  return (
    <div className={`${styles.page} page-container`}>
      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h2 className={styles.pageTitle}>Inventario y Productos</h2>
          <p className={styles.pageSub}>
            Gestiona tu catálogo, precios, categorías y códigos de barra.
          </p>
        </div>

        <div className={styles.headerActions}>
          {/* Scan button — mobile only */}
          <button
            type="button"
            className={`${styles.btnAction} ${styles.btnScan}`}
            onClick={() => setScannerActive(true)}
            aria-label="Escanear código de barras"
          >
            <ScanBarcode size={15} aria-hidden="true" />
            Escanear
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

          <Button
            variant="primary"
            className={styles.btnPrimaryAction}
            leftIcon={<Plus size={16} />}
            onClick={() => router.push('/productos/nuevo')}
            aria-label="Crear nuevo producto"
          >
            Nuevo
          </Button>
        </div>
      </div>

      {/* ── KPIs de inventario (USD + Bs, regla monetaria sellada) ── */}
      {!isLoading && products.length > 0 && (
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Inversión en inventario</span>
            <span className={styles.kpiValue}>{fmtUsd(kpis.inversion)}</span>
            <span className={styles.kpiValueBs}>{fmtBs(kpis.inversion, bcvRate)}</span>
            <span className={styles.kpiSub}>Costo total de productos en stock</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Estimado de venta</span>
            <span className={`${styles.kpiValue} ${styles.kpiSuccess}`}>{fmtUsd(kpis.estimadoVenta)}</span>
            <span className={styles.kpiValueBs}>{fmtBs(kpis.estimadoVenta, bcvRate)}</span>
            <span className={styles.kpiSub}>Si se vende todo el inventario</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Utilidad estimada</span>
            <span className={`${styles.kpiValue} ${kpis.utilidadEstimada >= 0 ? styles.kpiSuccess : styles.kpiDanger}`}>
              {fmtUsd(kpis.utilidadEstimada)}
            </span>
            <span className={styles.kpiValueBs}>{fmtBs(kpis.utilidadEstimada, bcvRate)}</span>
            <span className={styles.kpiSub}>Margen: {kpis.margen.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* ── Filter row: search + status tabs + count ── */}
      <div className={styles.filterRow}>
        <div className={styles.searchWrapper}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Nombre, SKU o código de barras…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar productos"
          />
          <button
            type="button"
            className={styles.searchScanBtn}
            onClick={() => setIsScanning(true)}
            aria-label="Escanear código de barras"
          >
            <ScanBarcode size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.statusTabsBar} role="tablist" aria-label="Filtrar por estado">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              role="tab"
              type="button"
              className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ''}`}
              onClick={() => setStatusFilter(s)}
              aria-selected={statusFilter === s}
            >
              {{ all: 'Todos', active: 'Activos', inactive: 'Inactivos' }[s]}
            </button>
          ))}
        </div>

        {!isLoading && products.length > 0 && (
          <span className={styles.countInfo}>
            {products.length} {products.length === 1 ? 'producto' : 'productos'}
          </span>
        )}
      </div>

      {/* ── Category tabs ── */}
      {categories.length > 0 && (
        <>
        <div className={styles.tabsBar} role="tablist" aria-label="Filtrar por categoría">
          <button
            role="tab"
            type="button"
            className={`${styles.catTab} ${selectedCategory === '' ? styles.catTabActive : ''}`}
            onClick={() => setSelectedCategory('')}
            aria-selected={selectedCategory === ''}
            disabled={reorderMode}
          >
            Todas las categorías
          </button>
          {categories.map((cat, i) => (
            <div key={cat.id} className={styles.catGroup}>
              <button
                role="tab"
                type="button"
                className={`${styles.catTab} ${selectedCategory === String(cat.id) ? styles.catTabActive : ''}`}
                onClick={() => { if (!reorderMode) setSelectedCategory(String(cat.id)) }}
                aria-selected={selectedCategory === String(cat.id)}
                disabled={reorderMode}
              >
                {cat.name}
              </button>
              {reorderMode ? (
                <>
                  <button
                    type="button"
                    className={styles.catEditBtn}
                    onClick={() => moveCategory(i, 'left')}
                    disabled={i === 0 || reordering}
                    aria-label={`Mover ${cat.name} a la izquierda`}
                  >
                    <ChevronLeft size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.catEditBtn}
                    onClick={() => moveCategory(i, 'right')}
                    disabled={i === categories.length - 1 || reordering}
                    aria-label={`Mover ${cat.name} a la derecha`}
                  >
                    <ChevronRight size={12} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.catEditBtn}
                    onClick={() => { setEditCategoryData(cat); setShowCategoryModal(true) }}
                    aria-label={`Editar categoría ${cat.name}`}
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.catEditBtn}
                    onClick={() => void handleDeleteCategory(cat)}
                    aria-label={`Eliminar categoría ${cat.name}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          ))}
          <button
            type="button"
            className={`${styles.catReorderToggle} ${reorderMode ? styles.catReorderToggleActive : ''}`}
            onClick={() => setReorderMode(m => !m)}
          >
            <ArrowLeftRight size={14} aria-hidden="true" />
            {reorderMode ? 'Listo' : 'Ordenar'}
          </button>
        </div>
        {reorderMode && (
          <p className={styles.catReorderHint}>
            Usa las flechas para ordenar. Las primeras categorías con productos aparecen en la portada del catálogo (hasta 4).
          </p>
        )}
        </>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableScroll}>
          <table className={styles.table} aria-label="Lista de productos">
            <thead>
              <tr>
                <th className={styles.th}>
                  <button type="button" className={styles.sortTh} onClick={() => handleSort('name')}>
                    Producto
                    {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                  </button>
                </th>
                <th className={styles.th}>
                  <button type="button" className={styles.sortTh} onClick={() => handleSort('price')}>
                    Precio (REF)
                    {sortKey === 'price' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                  </button>
                </th>
                <th className={`${styles.th} ${styles.thHidden}`}>Precio (Bs)</th>
                <th className={styles.th}>
                  <button type="button" className={styles.sortTh} onClick={() => handleSort('stock')}>
                    Stock
                    {sortKey === 'stock' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                  </button>
                </th>
                <th className={`${styles.th} ${styles.thHidden}`}>
                  <button type="button" className={styles.sortTh} onClick={() => handleSort('utility')}>
                    Utilidad
                    {sortKey === 'utility' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className={styles.sortIdle} />}
                  </button>
                </th>
                <th className={`${styles.th} ${styles.tdCenter} ${styles.thHidden}`}>Activo</th>
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
                        <Button
                          variant="primary"
                          leftIcon={<Plus size={15} />}
                          onClick={() => router.push('/productos/nuevo')}
                        >
                          Nuevo Producto
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : displayProducts.length === 0 && statusFilter !== 'all' ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}><Package size={24} aria-hidden="true" /></div>
                      <p className={styles.emptyTitle}>
                        No hay productos {statusFilter === 'active' ? 'activos' : 'inactivos'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayProducts.map((product) => {
                  const isInactive  = product.is_available === false
                  const stockLevel  = product.sale_mode === 'service' ? null : getStockLevel(product.stock_quantity, product.min_stock)
                  const utility     = product.cost_per_unit_usd !== null ? product.price_per_unit_usd - product.cost_per_unit_usd : null
                  const catBadgeClass = product.category ? CAT_BADGE[product.category.color] ?? styles.catGray : null
                  const thumbSrc    = product.image_path ?? product.images?.[0] ?? null

                  return (
                    <tr
                      key={product.id}
                      className={`${styles.tr} ${isInactive ? styles.trInactive : ''}`}
                    >
                      {/* PRODUCTO */}
                      <td className={styles.td} data-label="Producto">
                        <div className={styles.productCell}>
                          {thumbSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbSrc} alt={product.name} className={styles.productThumb} />
                          ) : (
                            <div className={styles.productThumbEmpty} aria-hidden="true">
                              <span className={styles.productThumbInitial}>{product.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className={styles.productInfo}>
                            <div className={styles.productNameRow}>
                              <span className={styles.productName}>{product.name}</span>
                              {isInactive && <span className={styles.inactiveBadge}>Inactivo</span>}
                            </div>
                            <div className={styles.productMeta}>
                              {product.category && catBadgeClass && (
                                <span className={`${styles.categoryBadge} ${catBadgeClass}`}>{product.category.name}</span>
                              )}
                              <span className={styles.saleModeTag}>{SALE_MODE_LABEL[product.sale_mode]}</span>
                              {product.has_variants && (
                                <span className={styles.variantBadge}><Layers size={10} aria-hidden="true" /> Variantes</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* PRECIO REF */}
                      <td className={styles.td} data-label="Precio"><span className={styles.priceRef}>{fmtUsd(product.price_per_unit_usd)}</span></td>

                      {/* PRECIO BS */}
                      <td className={`${styles.td} ${styles.tdHidden}`} data-label="Precio (Bs)"><span className={styles.priceBs}>{fmtBs(product.price_per_unit_usd, bcvRate)}</span></td>

                      {/* STOCK */}
                      <td className={styles.td} data-label="Stock">
                        {stockLevel === null ? (
                          <span className={styles.stockNone}>—</span>
                        ) : stockLevel === 'out' ? (
                          <span className={`${styles.stockBadge} ${styles.stockOut}`}>Agotado</span>
                        ) : (
                          <span className={`${styles.stockBadge} ${stockLevel === 'low' ? styles.stockLow : styles.stockOk}`}>
                            {product.stock_quantity}{product.sale_mode === 'weight' ? ' kg' : ' und'}
                          </span>
                        )}
                      </td>

                      {/* UTILIDAD */}
                      <td className={`${styles.td} ${styles.tdHidden}`} data-label="Utilidad">
                        {utility === null ? <span className={styles.utilityZero}>—</span> : (
                          <span className={utility > 0 ? styles.utilityPos : utility < 0 ? styles.utilityNeg : styles.utilityZero}>
                            {fmtUsd(utility)}
                          </span>
                        )}
                      </td>

                      {/* TOGGLE ACTIVO (FIX 3) */}
                      <td className={`${styles.td} ${styles.tdCenter} ${styles.tdHidden}`} data-label="Activo">
                        <label
                          className={styles.toggle}
                          title={isInactive ? 'Activar producto' : 'Desactivar producto'}
                          aria-label={isInactive ? `Activar ${product.name}` : `Desactivar ${product.name}`}
                        >
                          <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={!isInactive}
                            onChange={() => handleToggleAvailable(product)}
                          />
                          <span className={styles.toggleTrack} />
                          <span className={styles.toggleThumb} />
                        </label>
                      </td>

                      {/* ACCIONES */}
                      <td className={`${styles.td} ${styles.tdRight}`} data-label="Acciones">
                        <div className={styles.rowActions} role="group" aria-label={`Acciones: ${product.name}`}>
                          <button type="button" className={styles.rowActionBtn} title="Ajustar stock"
                            aria-label={`Ajustar stock de ${product.name}`}
                            onClick={() => setStockProduct(product)} disabled={product.sale_mode === 'service'}>
                            <Package size={15} aria-hidden="true" />
                          </button>
                          <button type="button" className={styles.rowActionBtn} title="Editar producto"
                            aria-label={`Editar ${product.name}`} onClick={() => router.push(`/productos/${product.id}/editar`)}>
                            <Edit2 size={15} aria-hidden="true" />
                          </button>
                          <button type="button" className={`${styles.rowActionBtn} ${styles.rowActionDanger}`}
                            title="Eliminar producto" aria-label={`Eliminar ${product.name}`}
                            onClick={() => handleDeleteClick(product)}>
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
        hasCatalogPlan={hasCatalogPlan}
        onClose={() => { setShowProductModal(false); setEditProduct(null) }}
        onSave={handleSaveProduct}
        onNewCategory={() => setShowCategoryModal(true)}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setEditCategoryData(null) }}
        initialData={editCategoryData ?? undefined}
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

      {/* ── Delete confirmation modal (FIX 2) ── */}
      {deleteModal && (
        <div className={styles.deleteOverlay} onClick={() => !deleteModal.saving && setDeleteModal(null)}>
          <div className={styles.deletePanel} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {deleteModal.phase === 'confirm' ? (
              <>
                <div className={styles.deletePanelHeader}>
                  <Trash2 size={20} className={styles.deletePanelIcon} aria-hidden="true" />
                  <h3 className={styles.deletePanelTitle}>¿Eliminar este producto?</h3>
                </div>
                <p className={styles.deletePanelMsg}>
                  Vas a eliminar <strong>{deleteModal.product.name}</strong>. Esta acción no se puede deshacer.
                </p>
                <div className={styles.deletePanelActions}>
                  <button
                    type="button"
                    className={styles.deleteBtnCancel}
                    onClick={() => setDeleteModal(null)}
                    disabled={deleteModal.saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtnForce}
                    onClick={() => void handleConfirmDelete()}
                    disabled={deleteModal.saving}
                  >
                    {deleteModal.saving ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.deletePanelHeader}>
                  <AlertTriangle size={20} className={styles.deletePanelIconWarning} aria-hidden="true" />
                  <h3 className={styles.deletePanelTitle}>Este producto tiene historial de ventas</h3>
                </div>
                <p className={styles.deletePanelMsg}>
                  Si eliminas <strong>{deleteModal.product.name}</strong> perderás el registro de ventas asociado.
                  Se recomienda desactivarlo para ocultarlo del POS sin borrar el historial.
                </p>
                <div className={styles.deletePanelActions}>
                  <button
                    type="button"
                    className={styles.deleteBtnDeactivate}
                    onClick={() => void handleDeactivateProduct()}
                    disabled={deleteModal.saving}
                  >
                    Desactivar (recomendado)
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtnForce}
                    onClick={() => void handleForceDelete()}
                    disabled={deleteModal.saving}
                  >
                    {deleteModal.saving ? 'Eliminando…' : 'Eliminar de todas formas'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Search barcode scanner overlay ── */}
      {isScanning && (
        <div
          className={styles.scanOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Escáner de código de barras"
        >
          <div ref={searchVideoRef} className={styles.scanVideo} aria-hidden="true" />
          <button
            type="button"
            className={styles.scanCloseBtn}
            onClick={() => setIsScanning(false)}
            aria-label="Cerrar escáner"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Mobile barcode scanner overlay ── */}
      {scannerActive && (
        <div
          className={styles.scanOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Escáner de código de barras"
        >
          {/* Camera — Quagga renders <video>+<canvas> inside this div */}
          <div
            ref={scanVideoRef}
            className={styles.scanVideo}
            aria-hidden="true"
          />

          {/* Viewfinder */}
          {!scanPermError && (
            <div className={styles.scanViewfinder} aria-hidden="true">
              <span className={`${styles.scanCorner} ${styles.scanCornerTL}`} />
              <span className={`${styles.scanCorner} ${styles.scanCornerTR}`} />
              <span className={`${styles.scanCorner} ${styles.scanCornerBL}`} />
              <span className={`${styles.scanCorner} ${styles.scanCornerBR}`} />
              <span className={styles.scanLine} />
            </div>
          )}

          {/* Status */}
          <div className={styles.scanBadge}>
            {scanPermError ? (
              <span>Activa la cámara en la configuración.</span>
            ) : (
              <>
                <span className={styles.scanDot} aria-hidden="true" />
                <span>Buscando producto...</span>
              </>
            )}
          </div>

          {/* Close */}
          <button
            type="button"
            className={styles.scanCloseBtn}
            onClick={() => setScannerActive(false)}
            aria-label="Cerrar escáner"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Not-found toast */}
          {scanToast && (
            <p className={styles.scanToast} role="status" aria-live="polite">
              {scanToast}
            </p>
          )}
        </div>
      )}
      <HelpButton module="productos" />
    </div>
  )
}
