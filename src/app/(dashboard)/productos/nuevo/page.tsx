'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useProductForm } from '@/hooks/useProductForm'
import { CategoryModal } from '@/components/products/CategoryModal'
import { ProductFormLayout } from '@/components/products/ProductFormLayout'
import type { ProductFormData, ModalCategory } from '@/components/products/ProductModal'
import m from '@/components/products/modals.module.css'
import s from './NuevoProducto.module.css'

const FORM_ID = 'nuevo-producto-form'

export default function NuevoProductoPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<ModalCategory[]>([])
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

  /* ── Guardar producto — mismo endpoint POST que el modal ── */
  const handleSave = useCallback(async (data: ProductFormData) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:               data.name,
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
        is_available:       data.isAvailable,
        catalog_visibility: data.catalogVisibility,
        availability:       data.availability,
        show_in_catalog:    data.catalogVisibility !== 'hidden',
        has_variants:       data.hasVariants,
        images:             data.images,
        badge:              data.badge || 'none',
        subcategory:        data.subcategory || null,
        is_featured:        data.isFeatured,
        stock_quantity:     data.stockInitial,
        stock_alert_threshold: data.stockAlertThreshold,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error ?? `Error ${res.status}`)
    }
    router.push('/productos')
  }, [router])

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

  const f = useProductForm({ hasCatalogPlan, onSave: handleSave })

  return (
    <div className={s.page}>
      {/* ── Header fijo ── */}
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link href="/productos" className={s.backLink} aria-label="Volver a Productos">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className={s.title}>Nuevo Producto</h1>
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
          <button type="submit" form={FORM_ID} className={m.btnPrimary} disabled={f.isSaving}>
            {f.isSaving && <span className={m.spinner} aria-hidden="true" />}
            {f.isSaving ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </header>

      <form id={FORM_ID} onSubmit={f.handleSubmit} noValidate className={s.grid}>
        <ProductFormLayout
          f={f}
          categories={categories}
          onNewCategory={() => setShowCategoryModal(true)}
        />
      </form>

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
      />
    </div>
  )
}
