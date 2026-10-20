'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useScanner } from '@/hooks/useScanner'
import type { VariantRow, SizeType } from '@/types/variantForm'
import { sizeTypeForGroup } from '@/lib/variantPresets'
import type {
  ProductFormData,
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
  barcode: string | null
  precio_extra: number
  price_usd: number | null
  stock: number
  variant_group: string | null
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
const MIN_IMAGE_SLOTS       = 6
const EMPTY_IMAGES: Array<string | null> = Array.from({ length: MIN_IMAGE_SLOTS }, () => null)
const COMPRESS_QUALITY      = 0.85

// iOS entrega HEIC, a veces con type vacío. El servidor no tiene códec HEVC y lo
// rechaza. El canvas de abajo ya reexporta a WebP: basta con que un HEIC pequeño
// no se salte la compresión por el umbral de tamaño.
function isHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || file.type === '' || /\.hei[cf]$/i.test(file.name)
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_KB * 1024 && !isHeic(file)) return file

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
  /** true justo después de que el efecto de abajo pobló los campos desde
   *  editProduct — marca cuándo es seguro capturar el snapshot "limpio"
   *  para el tracking de cambios sin guardar (ver isDirty más abajo). */
  const populatedRef = useRef(false)

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
  const [costUnknown, setCostUnknownRaw] = useState(false)
  const [isFixedPrice, setIsFixedPrice] = useState(false)
  const [financingEligible, setFinancingEligible] = useState(false)
  // El checkbox "Disponible con Cashea" solo aparece si el negocio activó el sello (Config → Tema).
  const [financingBadgeOn, setFinancingBadgeOn]   = useState(false)
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
  const [images, setImages]                 = useState<Array<string | null>>(EMPTY_IMAGES)
  const [uploadingSlot, setUploadingSlot]   = useState<number | null>(null)
  const [imgError, setImgError]             = useState<string | null>(null)
  const [isAvailable, setIsAvailable]       = useState(true)
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>('hidden')
  const [availability, setAvailability]     = useState<Availability>('in_stock')
  const [showCatalogUpgrade, setShowCatalogUpgrade] = useState(false)
  const [hasVariants, setHasVariants]       = useState(false)
  // Tabla de variantes (tallas/colores): una fila por variante, en alta y en edición.
  const [rows, setRows]                     = useState<VariantRow[]>([])
  const [sizeTypeId, setSizeTypeId]         = useState<string | null>(null)

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

  /* ── Variantes en DB (solo productos existentes) ── */
  const [loadingDbVars, setLoadingDbVars] = useState(false)
  // Foto de lo guardado: la tabla se compara contra esto al guardar (alta / cambio / baja).
  const savedRowsRef = useRef<VariantRow[]>([])
  const rowSeq       = useRef(0)
  const newKey       = () => `n${++rowSeq.current}`

  const fetchDbVariants = useCallback(async (productId: number, basePrice: number) => {
    setLoadingDbVars(true)
    try {
      const res = await fetch(`/api/products/${productId}/variants`)
      const j = await res.json() as { variants?: DbVariant[] }
      const loaded: VariantRow[] = (j.variants ?? []).map(v => ({
        key:     `v${v.id}`,
        id:      v.id,
        valor:   v.valor,
        tipo:    v.tipo === 'color' ? 'color' : v.tipo === 'talla' ? 'talla' : 'personalizado',
        group:   v.variant_group,
        stock:   String(v.stock),
        barcode: v.barcode ?? '',
        sku:     v.sku ?? '',
        // Antes se guardaba "precio extra"; el precio propio equivalente es base + extra.
        price:   v.price_usd != null ? String(v.price_usd) : v.precio_extra > 0 ? (basePrice + v.precio_extra).toFixed(2) : '',
      }))
      savedRowsRef.current = loaded
      setRows(loaded)
      if (loaded.length) setSizeTypeId(prev => prev ?? sizeTypeForGroup(loaded[0].group).id)
    } catch { /* non-critical */ }
    finally { setLoadingDbVars(false) }
  }, [])

  /* ── Escáner de barras ── */
  const [isScanning, setIsScanning] = useState(false)
  // null = código del producto; si no, la clave de la fila de talla que pidió el escaneo.
  const scanTargetRef = useRef<string | null>(null)
  const { videoContainerRef, permError } = useScanner({
    active: isScanning,
    onResult: (code) => {
      const target = scanTargetRef.current
      if (target) {
        updateRow(target, { barcode: code })
        void checkBarcode(target, code)
      } else {
        setBarcode(code)
      }
      setIsScanning(false)
    },
  })
  useEffect(() => { if (!isScanning) scanTargetRef.current = null }, [isScanning])
  const startRowScan = (key: string) => { scanTargetRef.current = key; setIsScanning(true) }

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

  const imgRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    let active = true
    fetch('/api/config/catalog')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { catalog?: { catalog_financing_badge?: string | null } } | null) => {
        if (active) setFinancingBadgeOn(!!data?.catalog?.catalog_financing_badge)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

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

    // Carga TODAS las fotos (mínimo MIN_IMAGE_SLOTS casillas): el PATCH reenvía lo que hay aquí, nunca recorta.
    const urls = editProduct.images ?? []
    setImages(Array.from({ length: Math.max(MIN_IMAGE_SLOTS, urls.length) }, (_, i) => urls[i] ?? null))

    setBadge(editProduct.badge ?? 'none')
    setSubcategory(editProduct.subcategory ?? '')
    setIsFeatured(editProduct.is_featured ?? false)
    setIsFixedPrice(editProduct.is_fixed_price ?? false)
    setCostUnknownRaw(editProduct.cost_unknown ?? false)
    setStockAlertThreshold(String(editProduct.stock_alert_threshold ?? 5))
    setStockInitial(String(editProduct.stock_quantity ?? 0))
    setFinancingEligible(editProduct.financing_eligible ?? false)

    const c =editProduct.cost_per_unit_usd ?? 0
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
    populatedRef.current = true
  }, [editProduct])

  /* ── Cargar variantes DB al editar un producto simple/peso existente ── */
  useEffect(() => {
    if (editProduct?.id && (productKind === 'simple' || productKind === 'weight')) {
      void fetchDbVariants(editProduct.id, editProduct.price_per_unit_usd ?? 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ── Costo desconocido: fuerza precio fijo (sin costo no hay margen que calcular) ── */
  const setCostUnknown = (v: boolean) => {
    setCostUnknownRaw(v)
    if (v) setIsFixedPrice(true)
  }

  /* ── Validación ── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio'
    if (!costUnknown && (!cost.trim() || parseFloat(cost) <= 0)) errs.cost = 'Ingresa el costo'
    if (!isFixedPrice) {
      const m = parseFloat(margin)
      if (isNaN(m) || m < 0 || m >= 100) errs.margin = 'Margen debe estar entre 0% y 99.9%'
    } else {
      if (!price.trim() || parseFloat(price) <= 0) errs.price = 'Ingresa el precio de venta'
    }
    if (hasVariants && productKind !== 'combo' && !combineVariants) {
      if (rows.length === 0) errs.variants = 'Toca al menos una talla, o apaga "Este producto tiene tallas".'
      else if (rows.some(r => r.barcodeError)) errs.variants = 'Corrige los códigos de barras marcados en rojo.'
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

  /* ── Tabla de variantes ── */
  const updateRow = (key: string, patch: Partial<VariantRow>) =>
    setRows(prev => prev.map(r => r.key === key
      ? { ...r, ...patch, ...('barcode' in patch ? { barcodeError: undefined } : {}) }
      : r))
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key))

  /** Paso 2: tocar una talla la agrega como fila. Si ya está, no hace nada. */
  const addSize = (type: SizeType, valor: string) => {
    const v = valor.trim()
    if (!v) return false
    if (rows.some(r => r.valor.toLowerCase() === v.toLowerCase())) return false
    setRows(prev => [...prev, {
      key: newKey(), valor: v, tipo: type.tipo, group: type.group,
      stock: '0', barcode: '', sku: '', price: '',
    }])
    return true
  }
  /** "Mismo stock para todas". */
  const setAllStock = (n: string) => setRows(prev => prev.map(r => ({ ...r, stock: n })))
  const variantStockTotal = rows.reduce((t, r) => t + Math.max(parseInt(r.stock) || 0, 0), 0)

  /** Error en línea: repetido en la lista, o ya usado por otro producto/talla del negocio. */
  const checkBarcode = async (key: string, raw?: string) => {
    const row  = rows.find(r => r.key === key)
    const code = (raw ?? row?.barcode ?? '').trim()
    const fail = (msg?: string) => setRows(prev => prev.map(r => r.key === key ? { ...r, barcodeError: msg } : r))
    if (!code) { fail(); return }
    if (rows.some(r => r.key !== key && r.barcode.trim() === code)) {
      fail('Este código ya está en otra talla de esta lista.'); return
    }
    if (barcode.trim() === code) {
      fail('Es el mismo código del producto. Cada talla necesita uno propio.'); return
    }
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(code)}`)
      if (!res.ok) return
      const j = await res.json() as {
        products?: Array<{ id: number; name: string; barcode: string | null; variants: Array<{ id: number; valor: string; barcode: string | null }> }>
      }
      for (const p of j.products ?? []) {
        if (p.barcode === code && p.id !== editProduct?.id) { fail(`Ese código ya pertenece al producto "${p.name}".`); return }
        const v = p.variants.find(x => x.barcode === code && x.id !== row?.id)
        if (v) { fail(`Ese código ya pertenece a la talla ${v.valor} de "${p.name}".`); return }
      }
      fail()
    } catch { /* el servidor igual lo valida al guardar */ }
  }

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

  /* ── Edición: aplica la tabla contra la API de variantes (alta / cambio / baja) ── */
  const syncVariants = async (): Promise<boolean> => {
    if (!editProduct?.id) return true
    const base = `/api/products/${editProduct.id}/variants`
    const json = { 'Content-Type': 'application/json' }
    const saved = new Map(savedRowsRef.current.map(r => [r.id, r]))
    let ok = true
    const fail = (key: string, msg: string, isBarcode: boolean) => {
      ok = false
      if (isBarcode) setRows(prev => prev.map(r => r.key === key ? { ...r, barcodeError: msg } : r))
      else setErrors(e => ({ ...e, submit: msg }))
    }
    const send = async (key: string, url: string, method: string, body?: object) => {
      const res = await fetch(url, { method, headers: json, body: body ? JSON.stringify(body) : undefined })
      if (res.ok) return
      const j = await res.json().catch(() => ({})) as { error?: string; field?: string }
      fail(key, j.error ?? `Error ${res.status}`, j.field === 'barcode')
    }
    const priceNum = (r: VariantRow) => (r.price.trim() === '' ? null : Math.max(parseFloat(r.price) || 0, 0))

    for (const old of savedRowsRef.current) {
      if (!rows.some(r => r.id === old.id)) await send(`v${old.id}`, `${base}/${old.id}`, 'DELETE')
    }
    for (const r of rows) {
      const stock = Math.max(parseInt(r.stock) || 0, 0)
      if (r.id === undefined) {
        const price = priceNum(r)
        await send(r.key, base, 'POST', {
          tipo: r.tipo, valor: r.valor.trim(), sku: r.sku.trim() || null, barcode: r.barcode.trim() || null,
          stock, price_usd: price, precio_extra: 0, variant_group: r.group,
        })
        continue
      }
      const o = saved.get(r.id)
      if (!o) continue
      const patch: Record<string, unknown> = {}
      if (r.valor.trim() !== o.valor)         patch.valor   = r.valor.trim()
      if (r.sku.trim() !== o.sku)             patch.sku     = r.sku.trim() || null
      if (r.barcode.trim() !== o.barcode)     patch.barcode = r.barcode.trim() || null
      if (stock !== (parseInt(o.stock) || 0)) patch.stock   = stock
      if (r.price.trim() !== o.price.trim())  { patch.price_usd = priceNum(r); patch.precio_extra = 0 }
      if (Object.keys(patch).length) await send(r.key, `${base}/${r.id}`, 'PATCH', patch)
    }
    return ok
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
      if (isEdit && hasVariants && !combineVariants && !(await syncVariants())) {
        setIsSaving(false)
        return
      }
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
        costUnknown,
        pricePerUnitUsd: computed.displayPrice,
        wholesalePriceUsd:      wholesalePriceUsd.trim()      ? parseFloat(wholesalePriceUsd)      : null,
        wholesalePricePerKgUsd: wholesalePricePerKgUsd.trim() ? parseFloat(wholesalePricePerKgUsd) : null,
        location: location.trim(),
        notes:    productNotes.trim(),
        // En edición la existencia puede ser decimal (peso): parseInt truncaría y generaría un delta falso.
        stockInitial:        hasVariants ? 0 : Math.max((isEdit ? parseFloat(stockInitial) : parseInt(stockInitial)) || 0, 0),
        stockChanged:        !isEdit || stockInitial !== String(editProduct?.stock_quantity ?? 0),
        stockAlertThreshold: Math.max(parseInt(stockAlertThreshold) || 0, 0),
        isAvailable,
        catalogVisibility,
        availability,
        hasVariants,
        images:   images.filter((u): u is string => u !== null),
        variants: combineVariants || isEdit ? [] : rows.map(r => ({
          name:            r.valor.trim(),
          price_extra_usd: 0,
          stock:           Math.max(parseInt(r.stock) || 0, 0),
          tipo:            r.tipo,
          variant_group:   r.group,
          sku:             r.sku.trim() || null,
          barcode:         r.barcode.trim() || null,
          price_usd:       r.price.trim() === '' ? null : Math.max(parseFloat(r.price) || 0, 0),
        })),
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
        isFixedPrice,
        financingEligible,
      })
    } catch {
      setErrors({ submit: 'Error al guardar. Intenta de nuevo.' })
      setIsSaving(false)
    }
  }

  const fmtUsd = (n: number) =>
    (n < 0 ? '-$' : '$') +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* ── Cambios sin guardar ──────────────────────────────────────────────
     Snapshot de los campos de CONTENIDO (no UI transitoria: búsquedas,
     drafts de variante, spinners) tomado en el primer render "limpio" —
     en alta es el default real de los useState (isEdit=false captura de
     inmediato); en edición espera a populatedRef (el efecto de arriba ya
     corrió) para no marcar dirty por el simple hecho de cargar el producto.
     dbVariants/varForm* quedan fuera: se guardan de inmediato contra la API
     (handleSaveVar/handleDeleteVar), no son parte de este submit. */
  const dirtySnapshot = JSON.stringify({
    name, description, barcode, productKind, measuredBy, unitLabel, unitStep,
    categoryId, costMode, bulkSize, cost, costUnknown, isFixedPrice, margin, price,
    stockInitial, stockAlertThreshold, showWholesale, wholesalePriceUsd,
    wholesalePricePerKgUsd, location, productNotes, images, isAvailable,
    catalogVisibility, availability, hasVariants, rows, combineVariants,
    dim1Values, dim2Values, combinations, badge, subcategory, isFeatured,
    components, financingEligible,
  })
  const initialSnapshotRef = useRef<string | null>(null)
  if (initialSnapshotRef.current === null && (!isEdit || populatedRef.current)) {
    initialSnapshotRef.current = dirtySnapshot
  }
  const isDirty = initialSnapshotRef.current !== null && initialSnapshotRef.current !== dirtySnapshot

  return {
    // meta
    isEdit,
    isDirty,
    // core state
    name, setName, description, setDescription, barcode, setBarcode,
    productKind, setProductKind, measuredBy, setMeasuredBy,
    unitLabel, setUnitLabel, unitStep, setUnitStep,
    categoryId, setCategoryId,
    costMode, setCostMode, bulkSize, setBulkSize, cost, setCost,
    costUnknown, setCostUnknown,
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
    financingEligible, setFinancingEligible, financingBadgeOn,
    // tabla de variantes
    hasVariants, setHasVariants, rows, loadingDbVars, sizeTypeId, setSizeTypeId,
    addSize, updateRow, removeRow, setAllStock, variantStockTotal, checkBarcode, startRowScan,
    // combined variants (2 dimensiones)
    combineVariants, setCombineVariants,
    dim1Values, dim1Input, setDim1Input, addDim1Value, removeDim1Value,
    dim2Values, dim2Input, setDim2Input, addDim2Value, removeDim2Value,
    combinations, generateCombinations, updateCombinationStock, updateCombinationExtra,
    // components (combo)
    components, compSearch, compResults, compQty, setCompQty, selectedComp, setSelectedComp,
    searchComponents, addComponent, removeComponent,
    // scanner
    isScanning, setIsScanning, videoContainerRef, permError,
    // submit
    validate, handleSubmit,
  }
}
