'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useProductForm } from '@/hooks/useProductForm'
import { CategoryModal } from '@/components/products/CategoryModal'
import { ProductFormLayout } from '@/components/products/ProductFormLayout'
import { SaveFab } from '@/components/products/SaveFab'
import type { ProductFormData, ModalCategory, EditableProduct } from '@/components/products/ProductModal'
import m from '@/components/products/modals.module.css'
import s from '../../nuevo/NuevoProducto.module.css'

const FORM_ID = 'editar-producto-form'

/* Forma parcial de la respuesta de GET /api/products/[id] — solo campos usados */
interface ApiProductDetail {
  id: number
  name: string
  description: string | null
  barcode: string | null
  sale_mode: EditableProduct['sale_mode']
  category_id: number | null
  cost_per_unit_usd: number | null
  price_per_unit_usd: number | null
  wholesale_price_usd?: number | null
  wholesale_price_per_kg_usd?: number | null
  location?: string | null
  notes?: string | null
  is_available?: boolean
  catalog_visibility?: EditableProduct['catalog_visibility']
  availability?: EditableProduct['availability']
  has_variants?: boolean
  images?: string | string[] | null
  badge?: string | null
  subcategory?: string | null
  is_featured?: boolean
  product_type?: EditableProduct['product_type']
  unit_type?: EditableProduct['unit_type']
  unit_label?: string
  unit_step?: number | string | null
  stock_alert_threshold?: number | null
}

/* images llega como string JSON crudo desde la DB (GET hace ...product) */
function parseImages(raw: ApiProductDetail['images']): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }
  return []
}

function toEditable(p: ApiProductDetail): EditableProduct {
  return {
    id:                 p.id,
    name:               p.name,
    description:        p.description,
    barcode:            p.barcode,
    sale_mode:          p.sale_mode,
    category_id:        p.category_id,
    cost_per_unit_usd:  p.cost_per_unit_usd,
    price_per_unit_usd: p.price_per_unit_usd ?? 0,
    wholesale_price_usd:        p.wholesale_price_usd,
    wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd,
    location:           p.location,
    notes:              p.notes,
    is_available:       p.is_available,
    catalog_visibility: p.catalog_visibility,
    availability:       p.availability,
    has_variants:       p.has_variants,
    images:             parseImages(p.images),
    badge:              p.badge,
    subcategory:        p.subcategory,
    is_featured:        p.is_featured,
    product_type:       p.product_type,
    unit_type:          p.unit_type,
    unit_label:         p.unit_label,
    unit_step:          p.unit_step != null ? Number(p.unit_step) : undefined,
    stock_alert_threshold: p.stock_alert_threshold,
  }
}

export default function EditarProductoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const productId = params.id

  const [editProduct, setEditProduct] = useState<EditableProduct | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [categories, setCategories]   = useState<ModalCategory[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
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

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/products/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories ?? [])
      }
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { void fetchCategories() }, [fetchCategories])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetch(`/api/products/${productId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? `Error ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setEditProduct(toEditable(data.product as ApiProductDetail))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el producto')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  /* ── Guardar cambios — PATCH /api/products/[id] (único método update del route) ── */
  const handleSave = useCallback(async (data: ProductFormData) => {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH',
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
        category_id:        data.categoryId,
        cost_per_unit_usd:  data.costPerUnitUsd,
        price_per_unit_usd: data.pricePerUnitUsd,
        wholesale_price_usd:        data.wholesalePriceUsd        ?? null,
        wholesale_price_per_kg_usd: data.wholesalePricePerKgUsd ?? null,
        location:           data.location || null,
        notes:              data.notes    || null,
        is_available:       data.isAvailable,
        catalog_visibility: data.catalogVisibility,
        availability:       data.availability,
        show_in_catalog:    data.catalogVisibility !== 'hidden',
        has_variants:       data.hasVariants,
        images:             data.images,
        badge:              data.badge || 'none',
        subcategory:        data.subcategory || null,
        is_featured:        data.isFeatured,
        stock_alert_threshold: data.stockAlertThreshold,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    router.push('/productos')
  }, [productId, router])

  const handleSaveCategory = useCallback(async (name: string, color: string, requiresPreparation: boolean) => {
    const res = await fetch('/api/products/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, requires_preparation: requiresPreparation }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    await fetchCategories()
  }, [fetchCategories])

  const f = useProductForm({ editProduct, hasCatalogPlan, onSave: handleSave })

  return (
    <div className={s.page}>
      {/* ── Header fijo ── */}
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link href="/productos" className={s.backLink} aria-label="Volver a Productos">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className={s.title}>{editProduct ? `Editar: ${editProduct.name}` : 'Editar Producto'}</h1>
        </div>
        <div className={s.headerActions}>
          <button
            type="button"
            className={`${m.btnSecondary} ${s.cancelHideMobile}`}
            onClick={() => router.back()}
            disabled={f.isSaving}
          >
            Cancelar
          </button>
          <button type="submit" form={FORM_ID} className={m.btnPrimary} disabled={f.isSaving || !editProduct}>
            {f.isSaving && <span className={m.spinner} aria-hidden="true" />}
            {f.isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className={s.card}>
          <Loader2 size={20} aria-label="Cargando" />
          <p className={m.label}>Cargando producto…</p>
        </div>
      ) : loadError ? (
        <div className={s.card}>
          <p className={m.errorMsg}>{loadError}</p>
          <button type="button" className={m.btnSecondary} onClick={() => router.push('/productos')}>
            Volver a Productos
          </button>
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={f.handleSubmit} noValidate className={s.grid}>
          <ProductFormLayout
            f={f}
            categories={categories}
            onNewCategory={() => setShowCategoryModal(true)}
          />
        </form>
      )}

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
      />

      {!loading && !loadError && (
        <SaveFab formId={FORM_ID} isSaving={f.isSaving} disabled={!editProduct} />
      )}
    </div>
  )
}
