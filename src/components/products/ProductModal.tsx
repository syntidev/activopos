'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Plus, ImagePlus, Loader2, Layers, Globe, Star, Box, Scale, Wrench, Boxes, Search, Pencil, Trash2 } from 'lucide-react'
import { CatalogUpgradeModal } from './CatalogUpgradeModal'
import mStyles from './modals.module.css'
import styles from './ProductModal.module.css'

/* ── Exported types ── */

export interface ProductVariantInput {
  id?: number
  name: string
  price_extra_usd: number
}

type CatalogVisibility = 'visible' | 'on_request' | 'hidden'
type Availability      = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'

export interface ProductFormData {
  name: string
  barcode: string
  saleMode: 'unit' | 'weight' | 'service'
  categoryId: number | null
  costPerUnitUsd: number
  pricePerUnitUsd: number
  stockInitial: number
  stockAlertThreshold: number
  isAvailable: boolean
  catalogVisibility: CatalogVisibility
  availability: Availability
  hasVariants: boolean
  images: string[]
  variants: ProductVariantInput[]
  badge: string
  subcategory: string
  isFeatured: boolean
  productType: 'simple' | 'combo' | 'fabricable'
  unitType: 'unit' | 'weight' | 'volume' | 'length'
  unitLabel: string
  unitStep: number
  components: Array<{ component_id: number; quantity: number }>
}

export interface ModalCategory {
  id: number
  name: string
  color: string
}

export interface EditableProduct {
  id: number
  name: string
  barcode: string | null
  sale_mode: 'unit' | 'weight' | 'service'
  category_id: number | null
  cost_per_unit_usd: number | null
  price_per_unit_usd: number
  is_available?: boolean
  catalog_visibility?: CatalogVisibility
  availability?: Availability
  has_variants?: boolean
  images?: string[]
  variants?: ProductVariantInput[]
  badge?: string | null
  subcategory?: string | null
  is_featured?: boolean
  product_type?: 'simple' | 'combo' | 'fabricable'
  unit_type?: 'unit' | 'weight' | 'volume' | 'length'
  unit_label?: string
  unit_step?: number
  stock_alert_threshold?: number | null
}

interface DbVariant {
  id: number
  tipo: string
  valor: string
  sku: string | null
  precio_extra: number
  price_usd: number | null
  stock: number
}

interface ProductModalProps {
  isOpen: boolean
  editProduct?: EditableProduct | null
  categories: ModalCategory[]
  hasCatalogPlan?: boolean
  onClose: () => void
  onSave: (data: ProductFormData) => Promise<void>
  onNewCategory: () => void
}

/* ── Constants ── */

type ProductKind = 'simple' | 'weight' | 'service' | 'combo'

interface ComponentEntry {
  component_id: number
  component_name: string
  quantity: number
  unit_label: string
}

interface CompProduct {
  id: number
  name: string
  unit_label: string
}

interface ApiProduct {
  id: number
  name: string
  unit_label?: string
  base_unit_label?: string
}

const TIPO_DEFS: Array<{
  value: ProductKind
  Icon: React.ElementType
  name: string
  desc: string
}> = [
  { value: 'simple',  Icon: Box,    name: 'Por unidad',    desc: 'Botellas, piezas, cajas' },
  { value: 'weight',  Icon: Scale,  name: 'Por medida',    desc: 'Peso, volumen, longitud' },
  { value: 'service', Icon: Wrench, name: 'Servicio',      desc: 'Sin inventario físico'   },
  { value: 'combo',   Icon: Boxes,  name: 'Combo',         desc: 'Descuenta ingredientes'  },
]

const UNIDADES: Record<'weight' | 'volume' | 'length', Array<{ value: string; label: string; step: number }>> = {
  weight: [
    { value: 'kg', label: 'Kilogramo (kg)', step: 0.001 },
    { value: 'g',  label: 'Gramo (g)',      step: 1     },
    { value: 'lb', label: 'Libra (lb)',      step: 0.001 },
  ],
  volume: [
    { value: 'L',  label: 'Litro (L)',       step: 0.01  },
    { value: 'ml', label: 'Mililitro (ml)',   step: 1     },
  ],
  length: [
    { value: 'm',  label: 'Metro (m)',        step: 0.01  },
    { value: 'cm', label: 'Centímetro (cm)',  step: 1     },
  ],
}

function getHint(kind: ProductKind): { title: string; examples: string } {
  switch (kind) {
    case 'simple':  return { title: 'Precio fijo por unidad', examples: 'Ej: botellas, piezas, cajas, paquetes, pares de zapatos' }
    case 'weight':  return { title: 'Precio por unidad de medida', examples: 'Ej: queso (kg), pollo (kg), jugo (L), tela (m), café (g)' }
    case 'service': return { title: 'Sin inventario físico', examples: 'Ej: instalación eléctrica, corte de cabello, consulta, envío' }
    case 'combo':   return { title: 'Descuenta componentes del inventario al vender', examples: 'Ej: combo de hamburguesa, kit de papelería, caja de maternidad' }
  }
}

const AVAIL_LABEL: Record<string, string> = {
  in_stock:     'En stock',
  low_stock:    'Stock bajo',
  out_of_stock: 'Sin stock',
  discontinued: 'Descontinuado',
}

const PRESET_GROUPS = [
  { id: 'ropa-adulto', label: 'Ropa adulto', values: ['XS','S','M','L','XL','XXL','XXXL'] },
  { id: 'ropa-nino',   label: 'Ropa niño',   values: ['2','4','6','8','10','12','14','16'] },
  { id: 'zap-adulto',  label: 'Zapato ad.',  values: ['35','36','37','38','39','40','41','42','43','44'] },
  { id: 'zap-nino',    label: 'Zapato niño', values: ['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'] },
  { id: 'colores',     label: 'Colores',     values: ['Negro','Blanco','Rojo','Azul','Verde','Amarillo','Naranja','Rosado','Gris','Morado'] },
] as const

/* ── Component ── */

export function ProductModal({
  isOpen,
  editProduct,
  categories,
  hasCatalogPlan = false,
  onClose,
  onSave,
  onNewCategory,
}: ProductModalProps) {
  useScrollLock(isOpen)

  const isEdit = !!editProduct

  /* ── Core form state ── */
  const [name, setName]           = useState('')
  const [barcode, setBarcode]     = useState('')
  const [productKind, setProductKind] = useState<ProductKind>('simple')
  const [measuredBy, setMeasuredBy]   = useState<'weight' | 'volume' | 'length'>('weight')
  const [unitLabel, setUnitLabel]     = useState('kg')
  const [unitStep, setUnitStep]       = useState(0.001)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [costMode, setCostMode]   = useState<'unit' | 'bulk'>('unit')
  const [bulkSize, setBulkSize]   = useState('12')
  const [cost, setCost]           = useState('')
  const [isFixedPrice, setIsFixedPrice] = useState(false)
  const [margin, setMargin]       = useState('30')
  const [price, setPrice]         = useState('')
  const [stockInitial, setStockInitial]             = useState('0')
  const [stockAlertThreshold, setStockAlertThreshold] = useState('5')
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [isSaving, setIsSaving]   = useState(false)

  /* ── Sprint 5+10: images, availability, catalog visibility, variants ── */
  const [images, setImages]                     = useState<Array<string | null>>([null, null, null])
  const [uploadingSlot, setUploadingSlot]       = useState<number | null>(null)
  const [isAvailable, setIsAvailable]           = useState(true)
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>('hidden')
  const [availability, setAvailability]         = useState<Availability>('in_stock')
  const [showCatalogUpgrade, setShowCatalogUpgrade] = useState(false)
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants]       = useState<ProductVariantInput[]>([])
  const [newVarName, setNewVarName]   = useState('')
  const [newVarExtra, setNewVarExtra] = useState('')
  const [badge, setBadge]             = useState('none')
  const [subcategory, setSubcategory] = useState('')
  const [isFeatured, setIsFeatured]   = useState(false)
  const [selectedPresetGroup, setSelectedPresetGroup] = useState<string | null>(null)

  /* ── DB variant management (existing products only) ── */
  const [dbVariants, setDbVariants]       = useState<DbVariant[]>([])
  const [loadingDbVars, setLoadingDbVars] = useState(false)
  const [showVarForm, setShowVarForm]     = useState(false)
  const [editingVar, setEditingVar]       = useState<DbVariant | null>(null)
  const [varFormValor, setVarFormValor]   = useState('')
  const [varFormTipo, setVarFormTipo]     = useState('personalizado')
  const [varFormSku, setVarFormSku]       = useState('')
  const [varFormExtra, setVarFormExtra]   = useState('')
  const [varFormStock, setVarFormStock]   = useState('0')
  const [varFormSaving, setVarFormSaving] = useState(false)

  const fetchDbVariants = useCallback(async (productId: number) => {
    setLoadingDbVars(true)
    try {
      const res = await fetch(`/api/products/${productId}/variants`)
      const j = await res.json()
      setDbVariants(j.variants ?? [])
    } catch { /* non-critical */ }
    finally { setLoadingDbVars(false) }
  }, [])

  /* ── Component editor state ── */
  const [components, setComponents]       = useState<ComponentEntry[]>([])
  const [compSearch, setCompSearch]       = useState('')
  const [compResults, setCompResults]     = useState<CompProduct[]>([])
  const [compQty, setCompQty]             = useState('1')
  const [selectedComp, setSelectedComp]   = useState<CompProduct | null>(null)

  /* ── Derived from productKind ── */
  const saleMode: 'unit' | 'weight' | 'service' =
    productKind === 'service' ? 'service' :
    productKind === 'weight'  ? 'weight'  : 'unit'
  const productType: 'simple' | 'combo' | 'fabricable' =
    productKind === 'combo' ? 'combo' : 'simple'
  const unitType: 'unit' | 'weight' | 'volume' | 'length' =
    productKind === 'weight' ? measuredBy : 'unit'

  const imgRef0 = useRef<HTMLInputElement>(null)
  const imgRef1 = useRef<HTMLInputElement>(null)
  const imgRef2 = useRef<HTMLInputElement>(null)
  const imgRefs = [imgRef0, imgRef1, imgRef2] as const

  /* ── Initialize / reset ── */
  useEffect(() => {
    if (!isOpen) {
      setName(''); setBarcode(''); setCategoryId(null)
      setProductKind('simple'); setMeasuredBy('weight'); setUnitLabel('kg'); setUnitStep(0.001)
      setComponents([]); setCompSearch(''); setCompResults([]); setCompQty('1'); setSelectedComp(null)
      setCostMode('unit'); setBulkSize('12'); setCost(''); setIsFixedPrice(false)
      setMargin('30'); setPrice(''); setStockInitial('0'); setStockAlertThreshold('5'); setErrors({})
      setIsSaving(false); setImages([null, null, null]); setIsAvailable(true)
      setCatalogVisibility('hidden'); setAvailability('in_stock')
      setHasVariants(false); setVariants([])
      setNewVarName(''); setNewVarExtra('')
      setBadge('none'); setSubcategory(''); setIsFeatured(false)
      setDbVariants([]); setShowVarForm(false); setEditingVar(null)
      return
    }

    if (editProduct) {
      setName(editProduct.name)
      setBarcode(editProduct.barcode ?? '')

      // Derive productKind from stored product_type + sale_mode
      if (editProduct.product_type === 'combo' || editProduct.product_type === 'fabricable') {
        setProductKind('combo')
      } else if (editProduct.sale_mode === 'service') {
        setProductKind('service')
      } else if (editProduct.sale_mode === 'weight') {
        setProductKind('weight')
        const ut = editProduct.unit_type
        const mb: 'weight' | 'volume' | 'length' =
          ut === 'volume' ? 'volume' : ut === 'length' ? 'length' : 'weight'
        setMeasuredBy(mb)
        const lbl = editProduct.unit_label ?? 'kg'
        setUnitLabel(lbl)
        const found = UNIDADES[mb].find(u => u.value === lbl)
        setUnitStep(found ? found.step : UNIDADES[mb][0].step)
      } else {
        setProductKind('simple')
      }

      setCategoryId(editProduct.category_id)
      setIsAvailable(editProduct.is_available ?? true)
      setCatalogVisibility(editProduct.catalog_visibility ?? 'hidden')
      setAvailability(editProduct.availability ?? 'in_stock')
      setHasVariants(editProduct.has_variants ?? false)
      setVariants(editProduct.variants ?? [])

      const loadedImgs: Array<string | null> = [null, null, null]
      editProduct.images?.forEach((url, i) => { if (i < 3) loadedImgs[i] = url })
      setImages(loadedImgs)

      setBadge(editProduct.badge ?? 'none')
      setSubcategory(editProduct.subcategory ?? '')
      setIsFeatured(editProduct.is_featured ?? false)
      setStockAlertThreshold(String(editProduct.stock_alert_threshold ?? 5))

      const c = editProduct.cost_per_unit_usd ?? 0
      const p = editProduct.price_per_unit_usd
      if (c > 0) setCost(c.toFixed(2))
      setPrice(p.toFixed(2))
      if (c > 0 && p > 0) {
        const m = ((p - c) / p) * 100
        setMargin(Math.max(0, m).toFixed(1))
      }
    }
  }, [isOpen, editProduct])

  /* ── Fetch DB variants when editing an existing simple product ── */
  useEffect(() => {
    if (isOpen && editProduct?.id && productKind === 'simple') {
      void fetchDbVariants(editProduct.id)
    }
  }, [isOpen, editProduct?.id, productKind, fetchDbVariants])

  /* ── Real-time price calculation ── */
  const computed = useMemo(() => {
    const costNum     = parseFloat(cost) || 0
    const bulkNum     = Math.max(parseInt(bulkSize) || 1, 1)
    const costPerUnit = costMode === 'bulk' ? costNum / bulkNum : costNum
    const marginNum   = Math.min(Math.max(parseFloat(margin) || 0, 0), 99.9)
    const priceFromMargin = costPerUnit > 0 && marginNum < 100
      ? costPerUnit / (1 - marginNum / 100)
      : costPerUnit
    const fixedPriceNum = parseFloat(price) || 0
    const displayPrice  = isFixedPrice ? fixedPriceNum : priceFromMargin
    const displayMargin = isFixedPrice && displayPrice > 0 && costPerUnit > 0
      ? Math.max(0, ((displayPrice - costPerUnit) / displayPrice) * 100)
      : marginNum
    return { costPerUnit, displayPrice, displayMargin, utility: displayPrice - costPerUnit }
  }, [cost, costMode, bulkSize, margin, price, isFixedPrice])

  /* ── Validation ── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio'
    if (!cost.trim() || parseFloat(cost) <= 0) errs.cost = 'Ingresa el costo'
    if (!isFixedPrice) {
      const m = parseFloat(margin)
      if (isNaN(m) || m < 0 || m >= 100) errs.margin = 'Margen debe estar entre 0% y 99.9%'
    } else {
      if (!price.trim() || parseFloat(price) <= 0) errs.price = 'Ingresa el precio de venta'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ── Image upload ── */
  const handleImageUpload = async (slot: number, file: File) => {
    setUploadingSlot(slot)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: fd })
      if (res.ok) {
        const j = await res.json()
        setImages(prev => {
          const next = [...prev]
          next[slot] = j.url as string
          return next
        })
      }
    } finally {
      setUploadingSlot(null)
    }
  }

  const removeImage = (slot: number) =>
    setImages(prev => { const n = [...prev]; n[slot] = null; return n })

  /* ── Variant management ── */
  const addVariant = () => {
    const name = newVarName.trim()
    if (!name) return
    setVariants(prev => [...prev, { name, price_extra_usd: parseFloat(newVarExtra) || 0 }])
    setNewVarName(''); setNewVarExtra('')
  }

  const removeVariant = (idx: number) =>
    setVariants(prev => prev.filter((_, i) => i !== idx))

  const addPreset = (name: string) => {
    if (variants.some(v => v.name === name)) return
    setVariants(prev => [...prev, { name, price_extra_usd: 0 }])
  }

  /* ── DB variant CRUD ── */
  const openVarForm = (v: DbVariant | null) => {
    setEditingVar(v)
    setVarFormValor(v?.valor ?? '')
    setVarFormTipo(v?.tipo ?? 'personalizado')
    setVarFormSku(v?.sku ?? '')
    setVarFormExtra(v ? String(v.precio_extra) : '')
    setVarFormStock(v ? String(v.stock) : '0')
    setShowVarForm(true)
  }

  const handleSaveVar = async () => {
    if (!editProduct?.id || !varFormValor.trim()) return
    setVarFormSaving(true)
    try {
      const body = {
        valor:        varFormValor.trim(),
        tipo:         varFormTipo,
        sku:          varFormSku.trim() || null,
        precio_extra: parseFloat(varFormExtra) || 0,
        price_usd:    null,
        stock:        parseInt(varFormStock) || 0,
      }
      const url    = editingVar
        ? `/api/products/${editProduct.id}/variants/${editingVar.id}`
        : `/api/products/${editProduct.id}/variants`
      const method = editingVar ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) {
        await fetchDbVariants(editProduct.id)
        setShowVarForm(false)
        setEditingVar(null)
      }
    } catch { /* silent */ }
    finally { setVarFormSaving(false) }
  }

  const handleDeleteVar = async (variantId: number) => {
    if (!editProduct?.id) return
    try {
      await fetch(`/api/products/${editProduct.id}/variants/${variantId}`, { method: 'DELETE' })
      await fetchDbVariants(editProduct.id)
    } catch { /* silent */ }
  }

  /* ── Component search ── */
  const searchComponents = async (q: string) => {
    setCompSearch(q)
    setSelectedComp(null)
    if (!q.trim()) { setCompResults([]); return }
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const data = await res.json()
        setCompResults(
          (data.products as ApiProduct[] ?? []).map(p => ({
            id: p.id,
            name: p.name,
            unit_label: p.unit_label ?? p.base_unit_label ?? 'und',
          }))
        )
      }
    } catch { /* silent */ }
  }

  const addComponent = () => {
    if (!selectedComp) return
    const qty = parseFloat(compQty)
    if (!qty || qty <= 0) return
    setComponents(prev => [
      ...prev,
      { component_id: selectedComp.id, component_name: selectedComp.name, quantity: qty, unit_label: selectedComp.unit_label },
    ])
    setSelectedComp(null); setCompSearch(''); setCompResults([]); setCompQty('1')
  }

  const removeComponent = (i: number) =>
    setComponents(prev => prev.filter((_, idx) => idx !== i))

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    try {
      await onSave({
        name:            name.trim(),
        barcode:         barcode.trim(),
        saleMode,
        productType,
        unitType,
        unitLabel:       productKind === 'weight' ? unitLabel : 'und',
        unitStep:        productKind === 'weight' ? unitStep  : 1,
        components:      components.map(c => ({ component_id: c.component_id, quantity: c.quantity })),
        categoryId,
        costPerUnitUsd:  computed.costPerUnit,
        pricePerUnitUsd: computed.displayPrice,
        stockInitial:         Math.max(parseInt(stockInitial) || 0, 0),
        stockAlertThreshold:  Math.max(parseInt(stockAlertThreshold) || 0, 0),
        isAvailable,
        catalogVisibility,
        availability,
        hasVariants,
        images:   images.filter((u): u is string => u !== null),
        variants,
        badge,
        subcategory:  subcategory.trim(),
        isFeatured,
      })
    } catch {
      setErrors({ submit: 'Error al guardar. Intenta de nuevo.' })
      setIsSaving(false)
    }
  }

  const fmtUsd = (n: number) =>
    (n < 0 ? '-$' : '$') +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* ── Render ── */
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={mStyles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            aria-modal="true"
            role="dialog"
            aria-label={isEdit ? `Editar ${editProduct?.name}` : 'Nuevo Producto'}
          >
            <motion.div
              className={`${mStyles.modal} ${mStyles.modalLg}`}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={mStyles.modalHeader}>
                <div>
                  <h2 className={mStyles.modalTitle}>
                    {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
                  </h2>
                  {isEdit && <p className={mStyles.modalSubtitle}>{editProduct?.name}</p>}
                </div>
                <button className={mStyles.closeBtn} onClick={onClose} aria-label="Cerrar">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} noValidate className={mStyles.modalForm}>
                <div className={mStyles.modalBody}>

                  {/* ── Nombre ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-name">
                      Nombre del Producto
                      <span className={mStyles.required} aria-hidden="true">*</span>
                    </label>
                    <input
                      id="pm-name"
                      type="text"
                      className={`${mStyles.input} ${errors.name ? mStyles.inputError : ''}`}
                      placeholder="Ej: Queso Blanco Duro, Refresco 500ml..."
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })) }}
                      maxLength={180}
                      autoFocus
                    />
                    {errors.name && <p className={mStyles.errorMsg}>{errors.name}</p>}
                  </div>

                  {/* ── Tipo de producto ── */}
                  <div className={mStyles.formGroup}>
                    <p className={mStyles.label}>¿Cómo vendes este producto?</p>
                    <div className={styles.tipoGrid}>
                      {TIPO_DEFS.map(({ value, Icon, name: tipName, desc }) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={productKind === value}
                          className={`${styles.tipoCard} ${productKind === value ? styles.tipoCardActive : ''}`}
                          onClick={() => setProductKind(value)}
                        >
                          <Icon size={18} className={styles.tipoIcon} aria-hidden="true" />
                          <span className={styles.tipoName}>{tipName}</span>
                          <span className={styles.tipoDesc}>{desc}</span>
                        </button>
                      ))}
                    </div>
                    {!name.trim() && (
                      <div className={styles.hintBox}>
                        <span className={styles.hintTitle}>{getHint(productKind).title}</span>
                        <span className={styles.hintExamples}>{getHint(productKind).examples}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Unidad de medida (solo tipo peso/volumen/longitud) ── */}
                  {productKind === 'weight' && (
                    <div className={styles.unidadSection}>
                      <div className={styles.pillGroup} role="radiogroup" aria-label="Tipo de medida">
                        {(['weight', 'volume', 'length'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={measuredBy === t}
                            className={`${styles.pill} ${measuredBy === t ? styles.pillActive : ''}`}
                            onClick={() => {
                              setMeasuredBy(t)
                              const first = UNIDADES[t][0]
                              setUnitLabel(first.value)
                              setUnitStep(first.step)
                            }}
                          >
                            {{ weight: 'Peso', volume: 'Volumen', length: 'Longitud' }[t]}
                          </button>
                        ))}
                      </div>
                      <select
                        className={mStyles.select}
                        value={unitLabel}
                        onChange={e => {
                          const u = UNIDADES[measuredBy].find(u => u.value === e.target.value)
                          if (u) { setUnitLabel(u.value); setUnitStep(u.step) }
                        }}
                        aria-label="Unidad de medida"
                      >
                        {UNIDADES[measuredBy].map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ── Editor de componentes (solo tipo combo) ── */}
                  {productKind === 'combo' && (
                    <div className={styles.componentesSection}>
                      <p className={mStyles.label}>Productos que incluye</p>

                      {components.map((comp, i) => (
                        <div key={i} className={styles.componentRow}>
                          <span className={styles.componentName}>{comp.component_name}</span>
                          <span className={styles.componentQtyLabel}>
                            {comp.quantity}&nbsp;{comp.unit_label}
                          </span>
                          <button
                            type="button"
                            className={styles.componentRemove}
                            onClick={() => removeComponent(i)}
                            aria-label={`Eliminar ${comp.component_name}`}
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </div>
                      ))}

                      <div className={styles.compAddRow}>
                        <div className={styles.compSearchWrap}>
                          <Search size={13} className={styles.compSearchIcon} aria-hidden="true" />
                          <input
                            type="text"
                            className={styles.compSearchInput}
                            placeholder="Buscar producto..."
                            value={compSearch}
                            onChange={e => searchComponents(e.target.value)}
                            aria-label="Buscar componente"
                            autoComplete="off"
                          />
                        </div>
                        <input
                          type="number"
                          className={styles.compQtyInput}
                          placeholder="Cant."
                          min="0.001"
                          step="0.001"
                          value={compQty}
                          onChange={e => setCompQty(e.target.value)}
                          aria-label="Cantidad del componente"
                        />
                        <button
                          type="button"
                          className={styles.compAddBtn}
                          onClick={addComponent}
                          disabled={!selectedComp || !compQty || parseFloat(compQty) <= 0}
                          aria-label="Agregar componente"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>

                      {compResults.filter(r => !components.some(c => c.component_id === r.id)).length > 0 && (
                        <div className={styles.compResults}>
                          {compResults
                            .filter(r => !components.some(c => c.component_id === r.id))
                            .map(p => (
                              <button
                                key={p.id}
                                type="button"
                                className={`${styles.compResult} ${selectedComp?.id === p.id ? styles.compResultActive : ''}`}
                                onClick={() => { setSelectedComp(p); setCompSearch(p.name); setCompResults([]) }}
                              >
                                <span>{p.name}</span>
                                <span className={styles.compResultUnit}>{p.unit_label}</span>
                              </button>
                            ))}
                        </div>
                      )}

                      {components.length > 0 && (
                        <p className={styles.componentPreview}>
                          Al vender 1 unidad se descuentan automáticamente{' '}
                          {components.length} {components.length === 1 ? 'producto' : 'productos'} del inventario.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Barcode ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-barcode">Código de Barras</label>
                    <input
                      id="pm-barcode"
                      type="text"
                      className={mStyles.input}
                      placeholder="EAN-13, QR, SKU..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      maxLength={60}
                    />
                  </div>

                  {/* ── Imágenes ── */}
                  <div className={mStyles.formGroup}>
                    <p className={mStyles.label}>Imágenes del Producto</p>
                    <div className={styles.imgGrid}>
                      {([0, 1, 2] as const).map((slot) => (
                        <div key={slot} className={`${styles.imgSlot} ${images[slot] ? styles.imgSlotFilled : ''}`}>
                          <input
                            ref={imgRefs[slot]}
                            type="file"
                            accept="image/*"
                            className={styles.imgFileInput}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImageUpload(slot, file)
                              e.target.value = ''
                            }}
                          />
                          {images[slot] ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={images[slot]!}
                                alt={`Foto ${slot + 1}`}
                                className={styles.imgPreview}
                              />
                              <button
                                type="button"
                                className={styles.imgRemoveBtn}
                                onClick={() => removeImage(slot)}
                                aria-label={`Eliminar foto ${slot + 1}`}
                              >
                                <X size={11} aria-hidden="true" />
                              </button>
                            </>
                          ) : uploadingSlot === slot ? (
                            <div className={styles.imgUploading}>
                              <Loader2 size={20} className={styles.spinnerIcon} aria-label="Subiendo..." />
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={styles.imgUploadBtn}
                              onClick={() => imgRefs[slot].current?.click()}
                            >
                              <ImagePlus size={18} aria-hidden="true" />
                              <span>Foto {slot + 1}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Categoría ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-category">Categoría</label>
                    <select
                      id="pm-category"
                      className={mStyles.select}
                      value={categoryId ?? ''}
                      onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">— Sin categoría —</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <button type="button" className={styles.newCategoryBtn} onClick={onNewCategory}>
                      <Plus size={12} aria-hidden="true" />
                      Nueva Categoría
                    </button>
                  </div>

                  {/* ── Subcategoría ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-subcategory">Subcategoría</label>
                    <input
                      id="pm-subcategory"
                      type="text"
                      className={mStyles.input}
                      placeholder="Ej: Camisas, Collares, Snacks, etc."
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      maxLength={60}
                    />
                  </div>

                  {/* ── Badge ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-badge">Badge en catálogo</label>
                    <select
                      id="pm-badge"
                      className={mStyles.select}
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                    >
                      <option value="none">Sin badge</option>
                      <option value="popular">Popular</option>
                      <option value="nuevo">Nuevo</option>
                      <option value="promo">Promo</option>
                      <option value="recomendado">Recomendado</option>
                    </select>
                  </div>

                  {/* ── Toggle: Destacado ── */}
                  <div className={styles.fixedPriceRow}>
                    <div className={styles.fixedPriceLabel}>
                      <Star size={14} className={styles.toggleIcon} aria-hidden="true" />
                      <div>
                        <span className={styles.fixedPriceTitle}>Destacado</span>
                        <span className={styles.fixedPriceSub}>
                          Aparece primero en el catálogo público
                        </span>
                      </div>
                    </div>
                    <label className={styles.toggle} aria-label="Destacado">
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                      />
                      <span className={styles.toggleTrack} />
                      <span className={styles.toggleThumb} />
                    </label>
                  </div>

                  {/* ── Toggle: Disponible para venta ── */}
                  <div className={styles.fixedPriceRow}>
                    <div className={styles.fixedPriceLabel}>
                      <span className={styles.fixedPriceTitle}>Disponible para venta</span>
                      <span className={styles.fixedPriceSub}>
                        Oculta el producto del POS si está desactivado
                      </span>
                    </div>
                    <label className={styles.toggle} aria-label="Disponible para venta">
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                      />
                      <span className={styles.toggleTrack} />
                      <span className={styles.toggleThumb} />
                    </label>
                  </div>

                  {/* ── Visibilidad y disponibilidad ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-catalog-vis">
                      <Globe size={13} className={styles.toggleIcon} aria-hidden="true" />
                      Visibilidad en catálogo
                    </label>
                    <select
                      id="pm-catalog-vis"
                      className={mStyles.select}
                      value={catalogVisibility}
                      onChange={(e) => {
                        const v = e.target.value as CatalogVisibility
                        if ((v === 'visible' || v === 'on_request') && !hasCatalogPlan) {
                          setShowCatalogUpgrade(true)
                        } else {
                          setCatalogVisibility(v)
                        }
                      }}
                    >
                      <option value="hidden">Oculto — solo visible en POS</option>
                      <option value="visible">Visible — con precio y botón de pedido</option>
                      <option value="on_request">Solo consulta — sin precio, botón WhatsApp</option>
                    </select>
                  </div>

                  {/* Disponibilidad — toggle para servicios */}
                  {saleMode === 'service' && (
                    <div className={styles.fixedPriceRow}>
                      <div className={styles.fixedPriceLabel}>
                        <span className={styles.fixedPriceTitle}>Estado del servicio</span>
                        <span className={styles.fixedPriceSub}>
                          {availability === 'discontinued'
                            ? 'Descontinuado — no aparece en catálogo ni POS'
                            : 'Activo — disponible para solicitar'}
                        </span>
                      </div>
                      <label className={styles.toggle} aria-label="Estado del servicio">
                        <input
                          type="checkbox"
                          className={styles.toggleInput}
                          checked={availability !== 'discontinued'}
                          onChange={(e) => setAvailability(e.target.checked ? 'in_stock' : 'discontinued')}
                        />
                        <span className={styles.toggleTrack} />
                        <span className={styles.toggleThumb} />
                      </label>
                    </div>
                  )}

                  {/* Disponibilidad calculada — badge read-only para físicos en edición */}
                  {saleMode !== 'service' && isEdit && editProduct?.availability && (
                    <div className={styles.availabilityReadOnly}>
                      <span className={styles.fixedPriceSub}>Disponibilidad en stock:</span>
                      <span className={`${styles.availabilityBadge} ${styles[`avail_${editProduct.availability}`]}`}>
                        {AVAIL_LABEL[editProduct.availability]}
                      </span>
                    </div>
                  )}

                  <div className={mStyles.divider} />

                  {/* ── Modo de costo ── */}
                  <div className={mStyles.formGroup}>
                    <p className={mStyles.label}>Ingresar Costo Por</p>
                    <div className={styles.pillGroup} role="radiogroup" aria-label="Modo de costo">
                      {(['unit', 'bulk'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={costMode === m}
                          className={`${styles.pill} ${costMode === m ? styles.pillActive : ''}`}
                          onClick={() => setCostMode(m)}
                        >
                          {m === 'unit' ? 'Unidad' : 'Bulto / Caja'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Tamaño del bulto ── */}
                  {costMode === 'bulk' && (
                    <div className={mStyles.formGroup}>
                      <label className={mStyles.label} htmlFor="pm-bulksize">
                        Unidades por bulto / caja
                      </label>
                      <input
                        id="pm-bulksize"
                        type="number"
                        className={mStyles.input}
                        placeholder="12"
                        value={bulkSize}
                        onChange={(e) => setBulkSize(e.target.value)}
                        min="1"
                        step="1"
                      />
                      {computed.costPerUnit > 0 && (
                        <p className={styles.bulkHint}>
                          Costo unitario equivalente:{' '}
                          <strong>{fmtUsd(computed.costPerUnit)}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Costo ── */}
                  <div className={mStyles.formGroup}>
                    <label className={mStyles.label} htmlFor="pm-cost">
                      Costo {costMode === 'bulk' ? 'por Bulto / Caja' : 'Unitario'} ($)
                      <span className={mStyles.required} aria-hidden="true">*</span>
                    </label>
                    <div className={`${styles.inputPrefix} ${errors.cost ? mStyles.inputError : ''}`}>
                      <span className={styles.prefixSymbol}>$</span>
                      <input
                        id="pm-cost"
                        type="number"
                        className={styles.prefixInput}
                        placeholder="0.00"
                        value={cost}
                        onChange={(e) => { setCost(e.target.value); if (errors.cost) setErrors(p => ({ ...p, cost: '' })) }}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {errors.cost && <p className={mStyles.errorMsg}>{errors.cost}</p>}
                  </div>

                  <div className={mStyles.divider} />

                  {/* ── Toggle precio fijo ── */}
                  <div className={styles.fixedPriceRow}>
                    <div className={styles.fixedPriceLabel}>
                      <span className={styles.fixedPriceTitle}>Usar Precios Fijos (Manuales)</span>
                      <span className={styles.fixedPriceSub}>
                        {isFixedPrice
                          ? 'Precio editable — margen se calcula automáticamente.'
                          : 'Precio calculado según el margen ingresado.'}
                      </span>
                    </div>
                    <label className={styles.toggle} aria-label="Activar precio fijo">
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={isFixedPrice}
                        onChange={(e) => {
                          const on = e.target.checked
                          setIsFixedPrice(on)
                          if (on && computed.displayPrice > 0) {
                            setPrice(computed.displayPrice.toFixed(2))
                          }
                        }}
                      />
                      <span className={styles.toggleTrack} />
                      <span className={styles.toggleThumb} />
                    </label>
                  </div>

                  {/* ── Margen + Precio ── */}
                  <div className={styles.inlineRow2}>
                    <div className={mStyles.formGroup}>
                      <label className={mStyles.label} htmlFor="pm-margin">Margen (%)</label>
                      <div className={`${styles.inputPrefix} ${isFixedPrice ? styles.inputPrefixCalculated : ''}`}>
                        <span className={styles.prefixSymbol}>%</span>
                        <input
                          id="pm-margin"
                          type="number"
                          className={`${styles.prefixInput} ${isFixedPrice ? styles.calculatedField : ''}`}
                          placeholder="30"
                          value={isFixedPrice ? computed.displayMargin.toFixed(1) : margin}
                          onChange={(e) => {
                            if (!isFixedPrice) {
                              setMargin(e.target.value)
                              if (errors.margin) setErrors(p => ({ ...p, margin: '' }))
                            }
                          }}
                          readOnly={isFixedPrice}
                          tabIndex={isFixedPrice ? -1 : 0}
                          min="0" max="99.9" step="0.1"
                        />
                      </div>
                      {errors.margin && <p className={mStyles.errorMsg}>{errors.margin}</p>}
                    </div>

                    <div className={mStyles.formGroup}>
                      <label className={mStyles.label} htmlFor="pm-price">Precio Venta ($)</label>
                      <div className={`${styles.inputPrefix} ${!isFixedPrice ? styles.inputPrefixCalculated : ''}`}>
                        <span className={styles.prefixSymbol}>$</span>
                        <input
                          id="pm-price"
                          type="number"
                          className={`${styles.prefixInput} ${!isFixedPrice ? styles.calculatedField : ''}`}
                          placeholder="0.00"
                          value={isFixedPrice ? price : computed.displayPrice > 0 ? computed.displayPrice.toFixed(2) : ''}
                          onChange={(e) => {
                            if (isFixedPrice) {
                              setPrice(e.target.value)
                              if (errors.price) setErrors(p => ({ ...p, price: '' }))
                            }
                          }}
                          readOnly={!isFixedPrice}
                          tabIndex={!isFixedPrice ? -1 : 0}
                          min="0" step="0.01"
                        />
                      </div>
                      {errors.price && <p className={mStyles.errorMsg}>{errors.price}</p>}
                    </div>
                  </div>

                  {/* ── Utilidad estimada ── */}
                  <div className={`${styles.utilityCard} ${computed.utility < 0 ? styles.utilityCardNegative : ''}`}>
                    <div className={styles.utilityInfo}>
                      <span className={`${styles.utilityLabel} ${computed.utility < 0 ? styles.utilityLabelNegative : ''}`}>
                        Utilidad estimada
                      </span>
                      <span className={styles.utilitySub}>por unidad</span>
                    </div>
                    <span className={`${styles.utilityAmount} ${computed.utility < 0 ? styles.utilityAmountNegative : ''}`}>
                      {fmtUsd(computed.utility)}
                    </span>
                  </div>

                  {/* ── Stock inicial (solo creación) ── */}
                  {!isEdit && saleMode !== 'service' && (
                    <>
                      <div className={mStyles.divider} />
                      <div className={mStyles.formGroup}>
                        <label className={mStyles.label} htmlFor="pm-stock">Stock Inicial</label>
                        <input
                          id="pm-stock"
                          type="number"
                          className={mStyles.input}
                          placeholder="0"
                          value={stockInitial}
                          onChange={(e) => setStockInitial(e.target.value)}
                          min="0"
                          step={saleMode === 'weight' ? '0.001' : '1'}
                        />
                      </div>
                    </>
                  )}

                  {/* ── Stock alert threshold (físicos) ── */}
                  {saleMode !== 'service' && (
                    <>
                      <div className={mStyles.divider} />
                      <div className={mStyles.formGroup}>
                        <label className={mStyles.label} htmlFor="pm-alert-threshold">
                          Alerta de stock crítico
                        </label>
                        <input
                          id="pm-alert-threshold"
                          type="number"
                          className={mStyles.input}
                          placeholder="5"
                          value={stockAlertThreshold}
                          onChange={(e) => setStockAlertThreshold(e.target.value)}
                          min="0"
                          step="1"
                        />
                        <p className={styles.fixedPriceSub}>
                          Avisar cuando el stock llegue a este nivel
                        </p>
                      </div>
                    </>
                  )}

                  {(productKind === 'simple' || productKind === 'weight') && (
                    <>
                      <div className={mStyles.divider} />

                      {/* ── Toggle: Tiene variantes ── */}
                      <div className={styles.fixedPriceRow}>
                        <div className={styles.fixedPriceLabel}>
                          <Layers size={14} className={styles.toggleIcon} aria-hidden="true" />
                          <div>
                            <span className={styles.fixedPriceTitle}>Tiene variantes (tallas/colores)</span>
                            <span className={styles.fixedPriceSub}>
                              El cajero elige variante antes de vender
                            </span>
                          </div>
                        </div>
                        <label className={styles.toggle} aria-label="Tiene variantes">
                          <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={hasVariants}
                            onChange={(e) => {
                              setHasVariants(e.target.checked)
                              if (!e.target.checked) setSelectedPresetGroup(null)
                            }}
                          />
                          <span className={styles.toggleTrack} />
                          <span className={styles.toggleThumb} />
                        </label>
                      </div>

                      {/* ── Sección Variantes ── */}
                      {hasVariants && (
                        <div className={styles.variantsSection}>
                          <p className={styles.sectionLabel}>Elige un tipo</p>
                          <div className={styles.presetGroupSelector}>
                            {PRESET_GROUPS.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className={`${styles.presetGroupBtn} ${selectedPresetGroup === g.id ? styles.presetGroupBtnActive : ''}`}
                                onClick={() => setSelectedPresetGroup(prev => prev === g.id ? null : g.id)}
                              >
                                {g.label}
                              </button>
                            ))}
                          </div>

                          {selectedPresetGroup && (
                            <div className={styles.presetGroup}>
                              {PRESET_GROUPS.find(g => g.id === selectedPresetGroup)?.values.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  className={`${styles.presetBtn} ${variants.some(va => va.name === v) ? styles.presetBtnActive : ''}`}
                                  onClick={() => addPreset(v)}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}

                          {variants.length > 0 && (
                            <div className={styles.variantList}>
                              {variants.map((v, i) => (
                                <div key={i} className={styles.variantRow}>
                                  <span className={styles.variantRowName}>{v.name}</span>
                                  {v.price_extra_usd > 0 && (
                                    <span className={styles.variantRowExtra}>
                                      +${v.price_extra_usd.toFixed(2)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className={styles.variantRemoveBtn}
                                    onClick={() => removeVariant(i)}
                                    aria-label={`Eliminar variante ${v.name}`}
                                  >
                                    <X size={13} aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className={styles.variantAddRow}>
                            <input
                              type="text"
                              className={`${mStyles.input} ${styles.variantNameInput}`}
                              placeholder="Nombre personalizado (ej: Talla M, Rojo)"
                              value={newVarName}
                              onChange={(e) => setNewVarName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariant() } }}
                              maxLength={60}
                            />
                            <input
                              type="number"
                              className={`${mStyles.input} ${styles.variantExtraInput}`}
                              placeholder="+$0.00"
                              value={newVarExtra}
                              onChange={(e) => setNewVarExtra(e.target.value)}
                              min="0"
                              step="0.01"
                              aria-label="Precio extra USD"
                            />
                            <button
                              type="button"
                              className={styles.variantAddBtn}
                              onClick={addVariant}
                              disabled={!newVarName.trim()}
                              aria-label="Añadir variante"
                            >
                              <Plus size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── DB Variants (editing existing simple/weight products) ── */}
                  {isEdit && editProduct?.id && (productKind === 'simple' || productKind === 'weight') && (
                    <div className={styles.dbVariantsSection}>
                      <div className={styles.dbVarsHeader}>
                        <p className={mStyles.label}>Variantes guardadas</p>
                        <button
                          type="button"
                          className={styles.dbVarsAddBtn}
                          onClick={() => { setShowVarForm(true); setEditingVar(null); setVarFormValor(''); setVarFormTipo('personalizado'); setVarFormSku(''); setVarFormExtra(''); setVarFormStock('0') }}
                        >
                          <Plus size={13} aria-hidden="true" />
                          Agregar
                        </button>
                      </div>

                      {loadingDbVars ? (
                        <div className={styles.dbVarEmpty}>
                          <Loader2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                          Cargando…
                        </div>
                      ) : dbVariants.length === 0 && !showVarForm ? (
                        <p className={styles.dbVarEmpty}>Sin variantes. Agrega la primera.</p>
                      ) : (
                        dbVariants.map(v => (
                          <div key={v.id} className={styles.dbVarRow}>
                            <span className={styles.dbVarName}>{v.valor}</span>
                            <span className={styles.dbVarPrice}>
                              ${(v.price_usd ?? v.precio_extra).toFixed(2)}
                            </span>
                            <span className={styles.dbVarStock}>{v.stock} und</span>
                            <button
                              type="button"
                              className={styles.dbVarAction}
                              onClick={() => openVarForm(v)}
                              aria-label={`Editar variante ${v.valor}`}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.dbVarAction} ${styles.dbVarActionDelete}`}
                              onClick={() => void handleDeleteVar(v.id)}
                              aria-label={`Eliminar variante ${v.valor}`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        ))
                      )}

                      {showVarForm && (
                        <div className={styles.dbVarForm}>
                          <div className={styles.dbVarFormRow}>
                            <input
                              type="text"
                              className={mStyles.input}
                              placeholder="Nombre* (ej: Talla M, Rojo)"
                              value={varFormValor}
                              onChange={(e) => setVarFormValor(e.target.value)}
                              maxLength={80}
                              aria-label="Nombre de variante"
                            />
                            <input
                              type="text"
                              className={mStyles.input}
                              placeholder="SKU"
                              value={varFormSku}
                              onChange={(e) => setVarFormSku(e.target.value)}
                              maxLength={60}
                              aria-label="SKU"
                              style={{ maxWidth: 110 }}
                            />
                          </div>
                          <div className={styles.dbVarFormRow}>
                            <input
                              type="number"
                              className={mStyles.input}
                              placeholder="Precio extra $"
                              value={varFormExtra}
                              onChange={(e) => setVarFormExtra(e.target.value)}
                              min="0"
                              step="0.01"
                              aria-label="Precio extra USD"
                            />
                            <input
                              type="number"
                              className={mStyles.input}
                              placeholder="Stock inicial"
                              value={varFormStock}
                              onChange={(e) => setVarFormStock(e.target.value)}
                              min="0"
                              step="1"
                              aria-label="Stock inicial"
                            />
                          </div>
                          <div className={styles.dbVarFormActions}>
                            <button
                              type="button"
                              className={styles.dbVarCancelBtn}
                              onClick={() => { setShowVarForm(false); setEditingVar(null) }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className={styles.dbVarSaveBtn}
                              onClick={() => void handleSaveVar()}
                              disabled={varFormSaving || !varFormValor.trim()}
                            >
                              {varFormSaving && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true" />}
                              {editingVar ? 'Actualizar' : 'Guardar variante'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {errors.submit && <p className={mStyles.errorMsg}>{errors.submit}</p>}
                </div>

                {/* Footer */}
                <div className={mStyles.modalFooter}>
                  <button type="button" className={mStyles.btnSecondary} onClick={onClose} disabled={isSaving}>
                    Cancelar
                  </button>
                  <button type="submit" className={mStyles.btnPrimary} disabled={isSaving}>
                    {isSaving && <span className={mStyles.spinner} aria-hidden="true" />}
                    {isSaving ? 'Guardando...' : 'Guardar Producto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CatalogUpgradeModal
        open={showCatalogUpgrade}
        onClose={() => setShowCatalogUpgrade(false)}
      />
    </>
  )
}
