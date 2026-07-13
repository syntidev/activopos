'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useScanner } from '@/hooks/useScanner'
import type {
  ProductFormData,
  ProductVariantInput,
  EditableProduct,
} from '@/components/products/ProductModal'

/* ── Tipos internos (idénticos a los del modal) ── */
type CatalogVisibility = 'visible' | 'on_request' | 'hidden'
type Availability      = 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
export type ProductKind = 'simple' | 'weight' | 'service' | 'combo'

interface DbVariant {
  id: number
  tipo: string
  valor: string
  sku: string | null
  precio_extra: number
  price_usd: number | null
  stock: number
}

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

export const UNIDADES: Record<'weight' | 'volume' | 'length', Array<{ value: string; label: string; step: number }>> = {
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

/* ── Compresión de imágenes client-side (Canvas API, sin librerías) ── */
const COMPRESS_THRESHOLD_KB = 800
const COMPRESS_MAX_DIM      = 1600
const COMPRESS_QUALITY      = 0.85

async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_KB * 1024) return file

  return new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        if (width > height) {
          height = Math.round(height * (COMPRESS_MAX_DIM / width))
          width  = COMPRESS_MAX_DIM
        } else {
          width  = Math.round(width * (COMPRESS_MAX_DIM / height))
          height = COMPRESS_MAX_DIM
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.webp'), {
            type: 'image/webp', lastModified: file.lastModified,
          }))
        },
        'image/webp',
        COMPRESS_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

interface UseProductFormArgs {
  editProduct?: EditableProduct | null
  hasCatalogPlan?: boolean
  onSave: (data: ProductFormData) => Promise<void>
}

/**
 * Toda la lógica de formulario de producto, extraída de ProductModal para que
 * /productos/nuevo y /productos/[id]/editar la compartan. Solo estado + handlers;
 * el JSX (layout 2 columnas) vive en cada página.
 */
export function useProductForm({ editProduct, hasCatalogPlan = false, onSave }: UseProductFormArgs) {
  const isEdit = !!editProduct

  /* ── Estado core ── */
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [barcode, setBarcode]         = useState('')
  const [productKind, setProductKind] = useState<ProductKind>('simple')
  const [measuredBy, setMeasuredBy]   = useState<'weight' | 'volume' | 'length'>('weight')
  const [unitLabel, setUnitLabel]     = useState('kg')
  const [unitStep, setUnitStep]       = useState(0.001)
  const [categoryId, setCategoryId]   = useState<number | null>(null)
  const [costMode, setCostMode]       = useState<'unit' | 'bulk'>('unit')
  const [bulkSize, setBulkSize]       = useState('12')
  const [cost, setCost]               = useState('')
  const [isFixedPrice, setIsFixedPrice] = useState(false)
  const [margin, setMargin]           = useState('30')
  const [price, setPrice]             = useState('')
  const [stockInitial, setStockInitial]               = useState('0')
  const [stockAlertThreshold, setStockAlertThreshold] = useState('5')
  const [showWholesale, setShowWholesale]         = useState(false)
  const [wholesalePriceUsd, setWholesalePriceUsd] = useState('')
  const [wholesalePricePerKgUsd, setWholesalePricePerKgUsd] = useState('')
  const [location, setLocation]                   = useState('')
  const [productNotes, setProductNotes]           = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [isSaving, setIsSaving]       = useState(false)

  /* ── Imágenes, disponibilidad, visibilidad, variantes ── */
  const [images, setImages]                 = useState<Array<string | null>>([null, null, null])
  const [uploadingSlot, setUploadingSlot]   = useState<number | null>(null)
  const [imgError, setImgError]             = useState<string | null>(null)
  const [isAvailable, setIsAvailable]       = useState(true)
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>('hidden')
  const [availability, setAvailability]     = useState<Availability>('in_stock')
  const [showCatalogUpgrade, setShowCatalogUpgrade] = useState(false)
  const [hasVariants, setHasVariants]       = useState(false)
  const [variants, setVariants]             = useState<ProductVariantInput[]>([])
  const [newVarName, setNewVarName]         = useState('')
  const [newVarExtra, setNewVarExtra]       = useState('')
  const [newVarStock, setNewVarStock]       = useState('0')

  /* ── Variantes combinadas (2 dimensiones, ej. Talla + Color) ── */
  const [combineVariants, setCombineVariants] = useState(false)
  const [dim1Values, setDim1Values]           = useState<string[]>([])
  const [dim1Input, setDim1Input]             = useState('')
  const [dim2Values, setDim2Values]           = useState<string[]>([])
  const [dim2Input, setDim2Input]             = useState('')
  const [combinations, setCombinations]       = useState<Array<{ key: string; stock: string; extra: string }>>([])
  const [badge, setBadge]                   = useState('none')
  const [subcategory, setSubcategory]       = useState('')
  const [isFeatured, setIsFeatured]         = useState(false)
  const [selectedPresetGroup, setSelectedPresetGroup] = useState<string | null>(null)

  /* ── Variantes en DB (solo productos existentes) ── */
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

  /* ── Escáner de barras ── */
  const [isScanning, setIsScanning] = useState(false)
  const { videoContainerRef, permError } = useScanner({
    active: isScanning,
    onResult: (code) => { setBarcode(code); setIsScanning(false) },
  })

  /* ── Editor de componentes (combo) ── */
  const [components, setComponents]   = useState<ComponentEntry[]>([])
  const [compSearch, setCompSearch]   = useState('')
  const [compResults, setCompResults] = useState<CompProduct[]>([])
  const [compQty, setCompQty]         = useState('1')
  const [selectedComp, setSelectedComp] = useState<CompProduct | null>(null)

  /* ── Derivados de productKind ── */
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

  /* ── Inicialización desde editProduct (o defaults en /nuevo) ── */
  useEffect(() => {
    if (!editProduct) return

    setName(editProduct.name)
    setDescription(editProduct.description ?? '')
    setBarcode(editProduct.barcode ?? '')

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

    const wUsd = editProduct.wholesale_price_usd
    const wKg  = editProduct.wholesale_price_per_kg_usd
    setWholesalePriceUsd(wUsd != null ? String(wUsd) : '')
    setWholesalePricePerKgUsd(wKg != null ? String(wKg) : '')
    setShowWholesale((wUsd != null && wUsd > 0) || (wKg != null && wKg > 0))
    setLocation(editProduct.location ?? '')
    setProductNotes(editProduct.notes ?? '')
  }, [editProduct])

  /* ── Cargar variantes DB al editar un producto simple/peso existente ── */
  useEffect(() => {
    if (editProduct?.id && (productKind === 'simple' || productKind === 'weight')) {
      void fetchDbVariants(editProduct.id)
    }
  }, [editProduct?.id, productKind, fetchDbVariants])

  /* ── Cálculo de precio en tiempo real ── */
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

  /* ── Validación ── */
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

  /* ── Subida de imágenes ── */
  const handleImageUpload = async (slot: number, file: File) => {
    setUploadingSlot(slot)
    setImgError(null)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.append('type', 'product')
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setImgError(err?.error ?? 'No se pudo subir la imagen')
        return
      }
      const j = await res.json()
      setImages(prev => { const next = [...prev]; next[slot] = j.url as string; return next })
    } catch {
      setImgError('Error de conexión al subir la imagen')
    } finally {
      setUploadingSlot(null)
    }
  }

  const removeImage = (slot: number) =>
    setImages(prev => { const n = [...prev]; n[slot] = null; return n })

  /* ── Variantes (nuevas, en memoria) ── */
  const addVariant = () => {
    const n = newVarName.trim()
    if (!n) return
    setVariants(prev => [...prev, {
      name: n,
      price_extra_usd: parseFloat(newVarExtra) || 0,
      stock: Math.max(parseInt(newVarStock) || 0, 0),
    }])
    setNewVarName(''); setNewVarExtra(''); setNewVarStock('0')
  }
  const removeVariant = (idx: number) =>
    setVariants(prev => prev.filter((_, i) => i !== idx))
  const addPreset = (n: string) => {
    if (variants.some(v => v.name === n)) return
    const tipo = selectedPresetGroup === 'colores' ? 'color' : 'talla'
    setVariants(prev => [...prev, { name: n, price_extra_usd: 0, stock: 0, tipo }])
  }
  const updateVariantStock = (idx: number, stock: number) =>
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, stock: Math.max(stock || 0, 0) } : v))

  /* ── Variantes combinadas: tallas × colores → producto cartesiano ── */
  const addDim1Value = () => {
    const v = dim1Input.trim()
    if (!v || dim1Values.includes(v)) return
    setDim1Values(prev => [...prev, v])
    setDim1Input('')
  }
  const removeDim1Value = (idx: number) =>
    setDim1Values(prev => prev.filter((_, i) => i !== idx))
  const addDim2Value = () => {
    const v = dim2Input.trim()
    if (!v || dim2Values.includes(v)) return
    setDim2Values(prev => [...prev, v])
    setDim2Input('')
  }
  const removeDim2Value = (idx: number) =>
    setDim2Values(prev => prev.filter((_, i) => i !== idx))

  // Recalcula el cartesiano. Conserva stock/precio ya cargado para las
  // combinaciones que sobreviven (evita perder datos si el usuario agrega
  // un valor más y vuelve a generar).
  const generateCombinations = () => {
    if (!dim1Values.length || !dim2Values.length) return
    const prevByKey = new Map(combinations.map(c => [c.key, c]))
    const next: Array<{ key: string; stock: string; extra: string }> = []
    for (const a of dim1Values) {
      for (const b of dim2Values) {
        const key = `${a}-${b}`
        next.push(prevByKey.get(key) ?? { key, stock: '0', extra: '0' })
      }
    }
    setCombinations(next)
  }

  const updateCombinationStock = (key: string, value: string) =>
    setCombinations(prev => prev.map(c => c.key === key ? { ...c, stock: value } : c))
  const updateCombinationExtra = (key: string, value: string) =>
    setCombinations(prev => prev.map(c => c.key === key ? { ...c, extra: value } : c))

  /* ── CRUD de variantes en DB ── */
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
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

  /* ── Búsqueda de componentes (combo) ── */
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
            id: p.id, name: p.name, unit_label: p.unit_label ?? p.base_unit_label ?? 'und',
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
        description:     description.trim() || null,
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
        wholesalePriceUsd:      wholesalePriceUsd.trim()      ? parseFloat(wholesalePriceUsd)      : null,
        wholesalePricePerKgUsd: wholesalePricePerKgUsd.trim() ? parseFloat(wholesalePricePerKgUsd) : null,
        location: location.trim(),
        notes:    productNotes.trim(),
        stockInitial:        hasVariants ? 0 : Math.max(parseInt(stockInitial) || 0, 0),
        stockAlertThreshold: Math.max(parseInt(stockAlertThreshold) || 0, 0),
        isAvailable,
        catalogVisibility,
        availability,
        hasVariants,
        images:   images.filter((u): u is string => u !== null),
        variants: combineVariants ? [] : variants,
        variantDimensions: combineVariants && combinations.length
          ? [{ tipo: 'talla', valores: dim1Values }, { tipo: 'color', valores: dim2Values }]
          : undefined,
        variantCombinations: combineVariants && combinations.length
          ? combinations.map(c => ({
              combination_key: c.key,
              stock:           Math.max(parseInt(c.stock) || 0, 0),
              precio_extra:    parseFloat(c.extra) || 0,
            }))
          : undefined,
        badge,
        subcategory: subcategory.trim(),
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

  return {
    // meta
    isEdit,
    // core state
    name, setName, description, setDescription, barcode, setBarcode,
    productKind, setProductKind, measuredBy, setMeasuredBy,
    unitLabel, setUnitLabel, unitStep, setUnitStep,
    categoryId, setCategoryId,
    costMode, setCostMode, bulkSize, setBulkSize, cost, setCost,
    isFixedPrice, setIsFixedPrice, margin, setMargin, price, setPrice,
    stockInitial, setStockInitial, stockAlertThreshold, setStockAlertThreshold,
    showWholesale, setShowWholesale,
    wholesalePriceUsd, setWholesalePriceUsd,
    wholesalePricePerKgUsd, setWholesalePricePerKgUsd,
    location, setLocation,
    productNotes, setProductNotes,
    errors, setErrors, isSaving,
    // derived
    saleMode, productType, unitType, computed, fmtUsd,
    // images
    images, uploadingSlot, imgError, imgRefs, handleImageUpload, removeImage,
    // catalog / availability
    isAvailable, setIsAvailable,
    catalogVisibility, setCatalogVisibility,
    availability, setAvailability,
    showCatalogUpgrade, setShowCatalogUpgrade, hasCatalogPlan,
    badge, setBadge, subcategory, setSubcategory, isFeatured, setIsFeatured,
    // in-memory variants
    hasVariants, setHasVariants, variants,
    newVarName, setNewVarName, newVarExtra, setNewVarExtra,
    newVarStock, setNewVarStock,
    selectedPresetGroup, setSelectedPresetGroup,
    addVariant, removeVariant, addPreset, updateVariantStock,
    // combined variants (2 dimensiones)
    combineVariants, setCombineVariants,
    dim1Values, dim1Input, setDim1Input, addDim1Value, removeDim1Value,
    dim2Values, dim2Input, setDim2Input, addDim2Value, removeDim2Value,
    combinations, generateCombinations, updateCombinationStock, updateCombinationExtra,
    // DB variants
    dbVariants, loadingDbVars, showVarForm, setShowVarForm,
    editingVar, setEditingVar,
    varFormValor, setVarFormValor, varFormTipo, setVarFormTipo,
    varFormSku, setVarFormSku, varFormExtra, setVarFormExtra,
    varFormStock, setVarFormStock, varFormSaving,
    openVarForm, handleSaveVar, handleDeleteVar,
    // components (combo)
    components, compSearch, compResults, compQty, setCompQty, selectedComp, setSelectedComp,
    searchComponents, addComponent, removeComponent,
    // scanner
    isScanning, setIsScanning, videoContainerRef, permError,
    // submit
    validate, handleSubmit,
  }
}
