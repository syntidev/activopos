'use client'

import { useEffect, useState } from 'react'
import {
  X, Plus, ImagePlus, Loader2, Layers, Globe, Star,
  Box, Scale, Wrench, Boxes, Search, ScanBarcode,
  Calculator, MapPin,
} from 'lucide-react'
import { UNIDADES, type ProductKind, type useProductForm } from '@/hooks/useProductForm'
import { categoryRequiresVariant } from '@/lib/variantPresets'
import { VariantEditor } from './VariantEditor'
import { AccordionCard } from './AccordionCard'
import { ProductTabBar, tabButtonId, tabPanelId, type ProductTabId } from './ProductTabs'
import { CatalogUpgradeModal } from './CatalogUpgradeModal'
import type { ModalCategory } from './ProductModal'
import m from './modals.module.css'
import c from './ProductModal.module.css'
import s from '@/app/(dashboard)/productos/nuevo/NuevoProducto.module.css'

/* ── Constantes presentacionales (compartidas por /nuevo y /[id]/editar) ── */

const TIPO_DEFS: Array<{ value: ProductKind; Icon: React.ElementType; name: string; desc: string }> = [
  { value: 'simple',  Icon: Box,    name: 'Por unidad', desc: 'Botellas, piezas, cajas' },
  { value: 'weight',  Icon: Scale,  name: 'Por medida', desc: 'Peso, volumen, longitud' },
  { value: 'service', Icon: Wrench, name: 'Servicio',   desc: 'Sin inventario físico'   },
  { value: 'combo',   Icon: Boxes,  name: 'Combo',      desc: 'Descuenta ingredientes'  },
]

function getHint(kind: ProductKind): { title: string; examples: string } {
  switch (kind) {
    case 'simple':  return { title: 'Precio fijo por unidad', examples: 'Ej: botellas, piezas, cajas, paquetes, pares de zapatos' }
    case 'weight':  return { title: 'Precio por unidad de medida', examples: 'Ej: queso (kg), pollo (kg), jugo (L), tela (m), café (g)' }
    case 'service': return { title: 'Sin inventario físico', examples: 'Ej: instalación eléctrica, corte de cabello, consulta, envío' }
    case 'combo':   return { title: 'Descuenta componentes del inventario al vender', examples: 'Ej: combo de hamburguesa, kit de papelería, caja de maternidad' }
  }
}

// PRESET_GROUPS/SHOE_GROUP_IDS: ver src/lib/variantPresets.ts (fuente única,
// también consumida por ProductModal.tsx).

interface ProductFormLayoutProps {
  f: ReturnType<typeof useProductForm>
  categories: ModalCategory[]
  onNewCategory: () => void
}

/**
 * Cuerpo del formulario de producto en layout de 2 columnas (cards).
 * Solo presentación — toda la lógica vive en useProductForm(). Consumido por
 * /productos/nuevo y /productos/[id]/editar. Debe renderizarse como hijo directo
 * de un <form className={s.grid}> para que la rejilla 50/50 funcione.
 *
 * Distribución (balanceada — ver Sprint 79):
 * izquierda = Información básica + Imágenes + Catálogo
 * derecha   = Precio + Inventario (stock/alerta) + Variantes (toggle + chips/tabla)
 */
export function ProductFormLayout({ f, categories, onNewCategory }: ProductFormLayoutProps) {
  /* Guía de descuento mayorista — solo interfaz de entrada (Mayoristas-Guia-1):
     %/$ acá calculan y escriben en f.wholesalePriceUsd/PerKgUsd, que siguen
     siendo los únicos campos que viajan al payload/schema. Estado local,
     no forma parte de useProductForm. */
  const [wholesaleMode, setWholesaleMode] = useState<'percent' | 'fixed'>('percent')
  const [wholesalePct, setWholesalePct]   = useState('')
  const [wholesaleAmt, setWholesaleAmt]   = useState('')

  // TAREA 4 (auditoría 2026-09-22): advertencia visual, NO bloqueo -- Carlos
  // no confirmó si prefiere bloquear el guardado, así que por ahora solo
  // avisa. Cubre los dos casos reales encontrados: el toggle "Tiene
  // variantes" apagado, y encendido pero sin ninguna talla agregada todavía.
  const [tab, setTab] = useState<ProductTabId>('basico')
  const tabErrors: Record<ProductTabId, boolean> = {
    basico:     !!f.errors.name,
    precio:     !!(f.errors.cost || f.errors.margin || f.errors.price),
    inventario: !!f.errors.variants,
    imagenes:   !!f.imgError,
    catalogo:   false,
    avanzado:   false,
  }
  // Al intentar guardar con errores, salta a la primera pestaña que los tiene.
  useEffect(() => {
    const first = (Object.keys(tabErrors) as ProductTabId[]).find(id => tabErrors[id])
    if (first && !tabErrors[tab]) setTab(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.errors])

  const selectedCategoryName = categories.find(cat => cat.id === f.categoryId)?.name ?? null
  const showSizeHint = categoryRequiresVariant(selectedCategoryName) && !f.hasVariants && f.rows.length === 0

  return (
    <>
      <ProductTabBar active={tab} onChange={setTab} errors={tabErrors} />

      <div role="tabpanel" id={tabPanelId('basico')} aria-labelledby={tabButtonId('basico')} hidden={tab !== 'basico'} className={s.panel}>
        {/* ── Card: Información básica ── */}
        <AccordionCard title="Información básica" defaultOpen hasError={!!f.errors.name}>
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-name">
              Nombre del Producto
              <span className={m.required} aria-hidden="true">*</span>
            </label>
            <input
              id="np-name"
              type="text"
              className={`${m.input} ${f.errors.name ? m.inputError : ''}`}
              placeholder="Ej: Queso Blanco Duro, Refresco 500ml..."
              value={f.name}
              onChange={(e) => { f.setName(e.target.value); if (f.errors.name) f.setErrors(p => ({ ...p, name: '' })) }}
              maxLength={180}
              autoFocus
            />
            {f.errors.name && <p className={m.errorMsg}>{f.errors.name}</p>}
          </div>

          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-description">
              Descripción
            </label>
            <textarea
              id="np-description"
              className={m.textarea}
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              placeholder="Describe el producto: materiales, medidas, usos, beneficios..."
              rows={3}
              maxLength={500}
            />
            <p className={c.hintExamples}>
              Aparece en la página del producto en el catálogo digital. Máximo 500 caracteres.
            </p>
          </div>

          {/* ¿Cómo vendes? */}
          <div className={m.formGroup}>
            <p className={m.label}>¿Cómo vendes este producto?</p>
            <div className={c.tipoGrid}>
              {TIPO_DEFS.map(({ value, Icon, name: tipName, desc }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={f.productKind === value}
                  className={`${c.tipoCard} ${f.productKind === value ? c.tipoCardActive : ''}`}
                  onClick={() => f.setProductKind(value)}
                >
                  <Icon size={18} className={c.tipoIcon} aria-hidden="true" />
                  <span className={c.tipoName}>{tipName}</span>
                  <span className={c.tipoDesc}>{desc}</span>
                </button>
              ))}
            </div>
            {!f.name.trim() && (
              <div className={c.hintBox}>
                <span className={c.hintTitle}>{getHint(f.productKind).title}</span>
                <span className={c.hintExamples}>{getHint(f.productKind).examples}</span>
              </div>
            )}
          </div>

          {/* Unidad de medida (tipo peso/volumen/longitud) */}
          {f.productKind === 'weight' && (
            <div className={c.unidadSection}>
              <div className={c.pillGroup} role="radiogroup" aria-label="Tipo de medida">
                {(['weight', 'volume', 'length'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={f.measuredBy === t}
                    className={`${c.pill} ${f.measuredBy === t ? c.pillActive : ''}`}
                    onClick={() => {
                      f.setMeasuredBy(t)
                      const first = UNIDADES[t][0]
                      f.setUnitLabel(first.value)
                      f.setUnitStep(first.step)
                    }}
                  >
                    {{ weight: 'Peso', volume: 'Volumen', length: 'Longitud' }[t]}
                  </button>
                ))}
              </div>
              <select
                className={m.select}
                value={f.unitLabel}
                onChange={e => {
                  const u = UNIDADES[f.measuredBy].find(u => u.value === e.target.value)
                  if (u) { f.setUnitLabel(u.value); f.setUnitStep(u.step) }
                }}
                aria-label="Unidad de medida"
              >
                {UNIDADES[f.measuredBy].map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Editor de componentes (tipo combo) */}
          {f.productKind === 'combo' && (
            <div className={c.componentesSection}>
              <p className={m.label}>Productos que incluye</p>

              {f.components.map((comp, i) => (
                <div key={i} className={c.componentRow}>
                  <span className={c.componentName}>{comp.component_name}</span>
                  <span className={c.componentQtyLabel}>{comp.quantity}&nbsp;{comp.unit_label}</span>
                  <button
                    type="button"
                    className={c.componentRemove}
                    onClick={() => f.removeComponent(i)}
                    aria-label={`Eliminar ${comp.component_name}`}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}

              <div className={c.compAddRow}>
                <div className={c.compSearchWrap}>
                  <Search size={13} className={c.compSearchIcon} aria-hidden="true" />
                  <input
                    type="text"
                    className={c.compSearchInput}
                    placeholder="Buscar producto..."
                    value={f.compSearch}
                    onChange={e => f.searchComponents(e.target.value)}
                    aria-label="Buscar componente"
                    autoComplete="off"
                  />
                </div>
                <input
                  type="number"
                  className={c.compQtyInput}
                  placeholder="Cant."
                  min="0.001"
                  step="0.001"
                  value={f.compQty}
                  onChange={e => f.setCompQty(e.target.value)}
                  aria-label="Cantidad del componente"
                />
                <button
                  type="button"
                  className={c.compAddBtn}
                  onClick={f.addComponent}
                  disabled={!f.selectedComp || !f.compQty || parseFloat(f.compQty) <= 0}
                  aria-label="Agregar componente"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              {f.compResults.filter(r => !f.components.some(cc => cc.component_id === r.id)).length > 0 && (
                <div className={c.compResults}>
                  {f.compResults
                    .filter(r => !f.components.some(cc => cc.component_id === r.id))
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`${c.compResult} ${f.selectedComp?.id === p.id ? c.compResultActive : ''}`}
                        onClick={() => { f.setSelectedComp(p) }}
                      >
                        <span>{p.name}</span>
                        <span className={c.compResultUnit}>{p.unit_label}</span>
                      </button>
                    ))}
                </div>
              )}

              {f.components.length > 0 && (
                <p className={c.componentPreview}>
                  Al vender 1 unidad se descuentan automáticamente{' '}
                  {f.components.length} {f.components.length === 1 ? 'producto' : 'productos'} del inventario.
                </p>
              )}
            </div>
          )}

          {/* SKU / referencia */}
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-sku">SKU / Referencia</label>
            <input
              id="np-sku"
              type="text"
              className={m.input}
              placeholder="Ej: CAM-0042"
              value={f.sku}
              onChange={(e) => f.setSku(e.target.value)}
              maxLength={50}
              aria-describedby="np-sku-help"
            />
            <p id="np-sku-help" className={c.fixedPriceSub}>Código interno o referencia del fabricante</p>
          </div>

          {/* Código de barras */}
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-barcode">Código de Barras</label>
            <div className={c.barcodeRow}>
              <input
                id="np-barcode"
                type="text"
                inputMode="text"
                className={m.input}
                placeholder="EAN-13, UPC o QR"
                value={f.barcode}
                onChange={(e) => f.setBarcode(e.target.value)}
                maxLength={60}
                aria-describedby={f.hasVariants ? 'np-barcode-help' : undefined}
              />
              <button
                type="button"
                className={c.scanBtn}
                onClick={() => f.setIsScanning(true)}
                aria-label="Escanear código de barras"
                title="Escanear con cámara"
              >
                <ScanBarcode size={16} aria-hidden="true" />
              </button>
            </div>
            {f.hasVariants && (
              <p id="np-barcode-help" className={c.fixedPriceSub}>
                Este producto tiene tallas: el código de barras y el SKU de cada talla se escriben en la pestaña Inventario y variantes.
              </p>
            )}
          </div>
        </AccordionCard>

      </div>

      <div role="tabpanel" id={tabPanelId('imagenes')} aria-labelledby={tabButtonId('imagenes')} hidden={tab !== 'imagenes'} className={s.panel}>
        {/* ── Card: Imágenes ── */}
        <AccordionCard title="Imágenes" defaultOpen hasError={!!f.imgError}>
          <div className={c.imgGrid}>
            {f.images.map((_, slot) => (
              <div key={slot} className={`${c.imgSlot} ${f.images[slot] ? c.imgSlotFilled : ''}`}>
                <input
                  ref={(el) => { f.imgRefs.current[slot] = el }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className={c.imgFileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) f.handleImageUpload(slot, file)
                    e.target.value = ''
                  }}
                />
                {f.images[slot] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.images[slot]!} alt={`Foto ${slot + 1}`} className={c.imgPreview} />
                    <span className={c.imgFormatBadge}>WebP</span>
                    <button
                      type="button"
                      className={c.imgRemoveBtn}
                      onClick={() => f.removeImage(slot)}
                      aria-label={`Eliminar foto ${slot + 1}`}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </>
                ) : f.uploadingSlot === slot ? (
                  <div className={c.imgUploading}>
                    <Loader2 size={20} className={c.spinnerIcon} aria-label="Subiendo..." />
                    <span className={c.imgUploadingText}>Comprimiendo y subiendo…</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={c.imgUploadBtn}
                    onClick={() => f.imgRefs.current[slot]?.click()}
                  >
                    <ImagePlus size={18} aria-hidden="true" />
                    <span>Foto {slot + 1}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          {f.imgError && <p className={m.errorMsg}>{f.imgError}</p>}
        </AccordionCard>

      </div>

      <div role="tabpanel" id={tabPanelId('catalogo')} aria-labelledby={tabButtonId('catalogo')} hidden={tab !== 'catalogo'} className={s.panel}>
        {/* ── Card: Catálogo ── */}
        <AccordionCard title="Catálogo" defaultOpen>
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-category">Categoría</label>
            <select
              id="np-category"
              className={m.select}
              value={f.categoryId ?? ''}
              onChange={(e) => f.setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">— Sin categoría —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button type="button" className={c.newCategoryBtn} onClick={onNewCategory}>
              <Plus size={12} aria-hidden="true" />
              Nueva Categoría
            </button>
          </div>

          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-subcategory">Subcategoría</label>
            <input
              id="np-subcategory"
              type="text"
              className={m.input}
              placeholder="Ej: Camisas, Collares, Snacks, etc."
              value={f.subcategory}
              onChange={(e) => f.setSubcategory(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-badge">Badge en catálogo</label>
            <select
              id="np-badge"
              className={m.select}
              value={f.badge}
              onChange={(e) => f.setBadge(e.target.value)}
            >
              <option value="none">Sin badge</option>
              <option value="popular">Popular</option>
              <option value="nuevo">Nuevo</option>
              <option value="promo">Promo</option>
              <option value="recomendado">Recomendado</option>
            </select>
          </div>

          {/* Toggle destacado */}
          <div className={c.fixedPriceRow}>
            <div className={c.fixedPriceLabel}>
              <Star size={14} className={c.toggleIcon} aria-hidden="true" />
              <div>
                <span className={c.fixedPriceTitle}>Destacado</span>
                <span className={c.fixedPriceSub}>Aparece primero en el catálogo público</span>
              </div>
            </div>
            <label className={c.toggle} aria-label="Destacado">
              <input
                type="checkbox"
                className={c.toggleInput}
                checked={f.isFeatured}
                onChange={(e) => f.setIsFeatured(e.target.checked)}
              />
              <span className={c.toggleTrack} />
              <span className={c.toggleThumb} />
            </label>
          </div>

          {/* Financiamiento: por defecto todos los productos entran; solo se marca para EXCLUIR. Visible si el negocio lo activó en Configuración → Tema */}
          {f.financingBadgeOn && (
            <div className={c.fixedPriceRow}>
              <div className={c.fixedPriceLabel}>
                <span className={c.fixedPriceTitle}>Excluir de financiamiento</span>
                <span className={c.fixedPriceSub}>Este producto no se ofrece en cuotas en el catálogo</span>
              </div>
              <label className={c.toggle} aria-label="Excluir de financiamiento">
                <input
                  type="checkbox"
                  className={c.toggleInput}
                  checked={f.financingExcluded}
                  onChange={(e) => f.setFinancingExcluded(e.target.checked)}
                />
                <span className={c.toggleTrack} />
                <span className={c.toggleThumb} />
              </label>
            </div>
          )}

          {/* Toggle disponible */}
          <div className={c.fixedPriceRow}>
            <div className={c.fixedPriceLabel}>
              <span className={c.fixedPriceTitle}>Disponible para venta</span>
              <span className={c.fixedPriceSub}>Oculta el producto del POS si está desactivado</span>
            </div>
            <label className={c.toggle} aria-label="Disponible para venta">
              <input
                type="checkbox"
                className={c.toggleInput}
                checked={f.isAvailable}
                onChange={(e) => f.setIsAvailable(e.target.checked)}
              />
              <span className={c.toggleTrack} />
              <span className={c.toggleThumb} />
            </label>
          </div>

          {/* Visibilidad en catálogo */}
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-catalog-vis">
              <Globe size={13} className={c.toggleIcon} aria-hidden="true" />
              Visibilidad en catálogo
            </label>
            <select
              id="np-catalog-vis"
              className={m.select}
              value={f.catalogVisibility}
              onChange={(e) => {
                const v = e.target.value as 'visible' | 'on_request' | 'hidden'
                if ((v === 'visible' || v === 'on_request') && !f.hasCatalogPlan) {
                  f.setShowCatalogUpgrade(true)
                } else {
                  f.setCatalogVisibility(v)
                }
              }}
            >
              <option value="hidden">Oculto — solo visible en POS</option>
              <option value="visible">Visible — con precio y botón de pedido</option>
              <option value="on_request">Solo consulta — sin precio, botón WhatsApp</option>
            </select>
          </div>

          {/* Estado del servicio (solo servicios) */}
          {f.saleMode === 'service' && (
            <div className={c.fixedPriceRow}>
              <div className={c.fixedPriceLabel}>
                <span className={c.fixedPriceTitle}>Estado del servicio</span>
                <span className={c.fixedPriceSub}>
                  {f.availability === 'discontinued'
                    ? 'Descontinuado — no aparece en catálogo ni POS'
                    : 'Activo — disponible para solicitar'}
                </span>
              </div>
              <label className={c.toggle} aria-label="Estado del servicio">
                <input
                  type="checkbox"
                  className={c.toggleInput}
                  checked={f.availability !== 'discontinued'}
                  onChange={(e) => f.setAvailability(e.target.checked ? 'in_stock' : 'discontinued')}
                />
                <span className={c.toggleTrack} />
                <span className={c.toggleThumb} />
              </label>
            </div>
          )}
        </AccordionCard>
      </div>

      <div role="tabpanel" id={tabPanelId('precio')} aria-labelledby={tabButtonId('precio')} hidden={tab !== 'precio'} className={s.panel}>
        {/* ── Card: Precio — a la vista solo Precio BCV y Precio Divisa; todo el cálculo vive detrás de UN toggle (apagado) ── */}
        {(() => {
          const normalPrice = f.computed.displayPrice
          const setWholesaleRaw = f.saleMode === 'weight' ? f.setWholesalePricePerKgUsd : f.setWholesalePriceUsd
          const wholesaleRaw   = f.saleMode === 'weight' ? f.wholesalePricePerKgUsd : f.wholesalePriceUsd
          const wholesaleValue = parseFloat(wholesaleRaw) || 0
          const wholesaleUtility = wholesaleValue - f.computed.costPerUnit

          return (
        <AccordionCard
          title="Precio"
          defaultOpen
          hasError={!!(f.errors.cost || f.errors.margin || f.errors.price)}
        >
          <div className={c.inlineRow2}>
            <div className={m.formGroup}>
              <label className={m.label} htmlFor="np-price">Precio BCV ($)</label>
              <div className={`${c.inputPrefix} ${!f.isFixedPrice ? c.inputPrefixCalculated : ''}`}>
                <span className={c.prefixSymbol}>$</span>
                <input
                  id="np-price"
                  type="number"
                  inputMode="numeric"
                  className={`${c.prefixInput} ${!f.isFixedPrice ? c.calculatedField : ''}`}
                  placeholder="0.00"
                  value={f.isFixedPrice ? f.price : f.computed.displayPrice > 0 ? f.computed.displayPrice.toFixed(2) : ''}
                  onChange={(e) => {
                    if (f.isFixedPrice) {
                      f.setPrice(e.target.value)
                      if (f.errors.price) f.setErrors(p => ({ ...p, price: '' }))
                    }
                  }}
                  readOnly={!f.isFixedPrice}
                  tabIndex={!f.isFixedPrice ? -1 : 0}
                  min="0" step="0.01"
                />
              </div>
              {f.errors.price && <p className={m.errorMsg}>{f.errors.price}</p>}
            </div>

            <div className={m.formGroup}>
              <label className={m.label} htmlFor="np-wholesale">
                Precio Divisa{f.saleMode === 'weight' ? ` por ${f.unitLabel}` : ''} ($)
              </label>
              <div className={c.inputPrefix}>
                <span className={c.prefixSymbol}>$</span>
                <input
                  id="np-wholesale"
                  type="number"
                  inputMode="numeric"
                  className={c.prefixInput}
                  placeholder="0.00"
                  value={wholesaleRaw}
                  onChange={(e) => setWholesaleRaw(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div className={c.fixedPriceRow}>
            <div className={c.fixedPriceLabel}>
              <Calculator size={14} className={c.toggleIcon} aria-hidden="true" />
              <span className={c.fixedPriceTitle}>Calcular con el sistema</span>
            </div>
            <label className={c.toggle} aria-label="Calcular con el sistema">
              <input
                type="checkbox"
                className={c.toggleInput}
                checked={f.calcSystem}
                onChange={(e) => f.toggleCalcSystem(e.target.checked)}
              />
              <span className={c.toggleTrack} />
              <span className={c.toggleThumb} />
            </label>
          </div>

          {f.calcSystem && (
            <>
          {/* Toggle costo desconocido */}
          <div className={c.fixedPriceRow}>
            <div className={c.fixedPriceLabel}>
              <span className={c.fixedPriceTitle}>No sé cuánto me cuesta</span>
              <span className={c.fixedPriceSub}>
                Oculta el costo y usa precio manual — sin costo no hay margen que calcular.
              </span>
            </div>
            <label className={c.toggle} aria-label="Costo desconocido">
              <input
                type="checkbox"
                className={c.toggleInput}
                checked={f.costUnknown}
                onChange={(e) => f.setCostUnknown(e.target.checked)}
              />
              <span className={c.toggleTrack} />
              <span className={c.toggleThumb} />
            </label>
          </div>

          {!f.costUnknown && (
            <>
              {/* Modo de costo */}
              <div className={m.formGroup}>
                <p className={m.label}>Ingresar Costo Por</p>
                <div className={c.pillGroup} role="radiogroup" aria-label="Modo de costo">
                  {(['unit', 'bulk'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={f.costMode === mode}
                      className={`${c.pill} ${f.costMode === mode ? c.pillActive : ''}`}
                      onClick={() => f.setCostMode(mode)}
                    >
                      {mode === 'unit' ? 'Unidad' : 'Bulto / Caja'}
                    </button>
                  ))}
                </div>
              </div>

              {f.costMode === 'bulk' && (
                <div className={m.formGroup}>
                  <label className={m.label} htmlFor="np-bulksize">Unidades por bulto / caja</label>
                  <input
                    id="np-bulksize"
                    type="number"
                    className={m.input}
                    placeholder="12"
                    value={f.bulkSize}
                    onChange={(e) => f.setBulkSize(e.target.value)}
                    min="1"
                    step="1"
                  />
                  {f.computed.costPerUnit > 0 && (
                    <p className={c.bulkHint}>
                      Costo unitario equivalente: <strong>{f.fmtUsd(f.computed.costPerUnit)}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className={m.formGroup}>
                <label className={m.label} htmlFor="np-cost">
                  Costo {f.costMode === 'bulk' ? 'por Bulto / Caja' : 'Unitario'} ($)
                  <span className={m.required} aria-hidden="true">*</span>
                </label>
                <div className={`${c.inputPrefix} ${f.errors.cost ? m.inputError : ''}`}>
                  <span className={c.prefixSymbol}>$</span>
                  <input
                    id="np-cost"
                    type="number"
                    inputMode="numeric"
                    className={c.prefixInput}
                    placeholder="0.00"
                    value={f.cost}
                    onChange={(e) => { f.setCost(e.target.value); if (f.errors.cost) f.setErrors(p => ({ ...p, cost: '' })) }}
                    min="0"
                    step="0.01"
                  />
                </div>
                {f.errors.cost && <p className={m.errorMsg}>{f.errors.cost}</p>}
              </div>
            </>
          )}


              {!f.costUnknown && (
                <>
            <div className={m.formGroup}>
              <label className={m.label} htmlFor="np-margin">Margen (%)</label>
              <div className={`${c.inputPrefix} ${f.isFixedPrice ? c.inputPrefixCalculated : ''}`}>
                <span className={c.prefixSymbol}>%</span>
                <input
                  id="np-margin"
                  type="number"
                  className={`${c.prefixInput} ${f.isFixedPrice ? c.calculatedField : ''}`}
                  placeholder="30"
                  value={f.isFixedPrice ? f.computed.displayMargin.toFixed(1) : f.margin}
                  onChange={(e) => {
                    if (!f.isFixedPrice) {
                      f.setMargin(e.target.value)
                      if (f.errors.margin) f.setErrors(p => ({ ...p, margin: '' }))
                    }
                  }}
                  readOnly={f.isFixedPrice}
                  tabIndex={f.isFixedPrice ? -1 : 0}
                  min="0" max="99.9" step="0.1"
                />
              </div>
              {f.errors.margin && <p className={m.errorMsg}>{f.errors.margin}</p>}
            </div>


                </>
              )}
          {/* Utilidad estimada */}
          {f.costUnknown ? (
            <div className={c.utilityCard}>
              <div className={c.utilityInfo}>
                <span className={c.utilityLabel}>Sin costo cargado</span>
                <span className={c.utilitySub}>No se puede calcular la utilidad</span>
              </div>
            </div>
          ) : (
            <div className={`${c.utilityCard} ${f.computed.utility < 0 ? c.utilityCardNegative : ''}`}>
              <div className={c.utilityInfo}>
                <span className={`${c.utilityLabel} ${f.computed.utility < 0 ? c.utilityLabelNegative : ''}`}>
                  Utilidad estimada
                </span>
                <span className={c.utilitySub}>por unidad</span>
              </div>
              <span className={`${c.utilityAmount} ${f.computed.utility < 0 ? c.utilityAmountNegative : ''}`}>
                {f.fmtUsd(f.computed.utility)}
              </span>
            </div>
          )}

              <div className={m.divider} />
              <>
                <div className={m.formGroup}>
                  <p className={m.label}>Calcular Descuento Por</p>
                  <div className={c.pillGroup} role="radiogroup" aria-label="Modo de descuento Divisa">
                    {(['percent', 'fixed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={wholesaleMode === mode}
                        className={`${c.pill} ${wholesaleMode === mode ? c.pillActive : ''}`}
                        onClick={() => setWholesaleMode(mode)}
                      >
                        {mode === 'percent' ? '% Descuento' : '$ Fijo'}
                      </button>
                    ))}
                  </div>
                </div>

                {wholesaleMode === 'percent' ? (
                  <div className={m.formGroup}>
                    <label className={m.label} htmlFor="np-wholesale-pct">Descuento (%)</label>
                    <div className={c.inputPrefix}>
                      <span className={c.prefixSymbol}>%</span>
                      <input
                        id="np-wholesale-pct"
                        type="number"
                        inputMode="numeric"
                        className={c.prefixInput}
                        placeholder="0"
                        value={wholesalePct}
                        onChange={(e) => {
                          setWholesalePct(e.target.value)
                          const pct = parseFloat(e.target.value)
                          if (!isNaN(pct) && normalPrice > 0) {
                            setWholesaleRaw((normalPrice * (1 - pct / 100)).toFixed(2))
                          }
                        }}
                        min="0" max="100" step="0.1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={m.formGroup}>
                    <label className={m.label} htmlFor="np-wholesale-amt">Descuento ($)</label>
                    <div className={c.inputPrefix}>
                      <span className={c.prefixSymbol}>$</span>
                      <input
                        id="np-wholesale-amt"
                        type="number"
                        inputMode="numeric"
                        className={c.prefixInput}
                        placeholder="0.00"
                        value={wholesaleAmt}
                        onChange={(e) => {
                          setWholesaleAmt(e.target.value)
                          const amt = parseFloat(e.target.value)
                          if (!isNaN(amt)) {
                            setWholesaleRaw(Math.max(0, normalPrice - amt).toFixed(2))
                          }
                        }}
                        min="0" step="0.01"
                      />
                    </div>
                  </div>
                )}

                {normalPrice > 0 && (
                  <p className={c.fixedPriceSub}>
                    Precio normal {f.fmtUsd(normalPrice)} − {wholesaleMode === 'percent'
                      ? `${wholesalePct || 0}%`
                      : f.fmtUsd(parseFloat(wholesaleAmt) || 0)} = {f.fmtUsd(wholesaleValue)} Divisa
                  </p>
                )}


                {wholesaleValue > 0 && !f.costUnknown && (
                  <div className={`${c.utilityCard} ${wholesaleUtility < 0 ? c.utilityCardNegative : ''}`}>
                    <div className={c.utilityInfo}>
                      <span className={`${c.utilityLabel} ${wholesaleUtility < 0 ? c.utilityLabelNegative : ''}`}>
                        Utilidad con precio Divisa
                      </span>
                      <span className={c.utilitySub}>por unidad</span>
                    </div>
                    <span className={`${c.utilityAmount} ${wholesaleUtility < 0 ? c.utilityAmountNegative : ''}`}>
                      {f.fmtUsd(wholesaleUtility)}
                    </span>
                  </div>
                )}

              </>
            </>
          )}
        </AccordionCard>
          )
        })()}

      </div>

      <div role="tabpanel" id={tabPanelId('inventario')} aria-labelledby={tabButtonId('inventario')} hidden={tab !== 'inventario'} className={s.panel}>
        {f.saleMode === 'service' && (
          <p className={c.fixedPriceSub}>Un servicio no maneja inventario ni tallas.</p>
        )}

        {/* ── Card: Inventario (stock + alerta — sin variantes) ── */}
        {f.saleMode !== 'service' && (
          <AccordionCard title="Inventario" defaultOpen>
            {!f.hasVariants && (
              <div className={m.formGroup}>
                <label className={m.label} htmlFor="np-stock">{f.isEdit ? 'Existencia actual' : 'Stock Inicial'}</label>
                <input
                  id="np-stock"
                  type="number"
                  className={m.input}
                  placeholder="0"
                  value={f.stockInitial}
                  onChange={(e) => f.setStockInitial(e.target.value)}
                  min="0"
                  step={f.saleMode === 'weight' ? '0.001' : '1'}
                />
              </div>
            )}

            <div className={m.formGroup}>
              <label className={m.label} htmlFor="np-alert-threshold">Alerta de stock crítico</label>
              <input
                id="np-alert-threshold"
                type="number"
                inputMode="numeric"
                className={m.input}
                placeholder="5"
                value={f.stockAlertThreshold}
                onChange={(e) => f.setStockAlertThreshold(e.target.value)}
                min="0"
                step="1"
              />
              <p className={c.fixedPriceSub}>Avisar cuando el stock llegue a este nivel</p>
            </div>
          </AccordionCard>
        )}

        {/* ── Card: Variantes (toggle + chips/tabla — propia tarjeta) ── */}
        {f.saleMode !== 'service' && (f.productKind === 'simple' || f.productKind === 'weight') && (
          <section className={s.card}>
            <h2 className={s.cardTitle}>Variantes</h2>

            {/* Toggle variantes */}
            <div className={c.fixedPriceRow}>
              <div className={c.fixedPriceLabel}>
                <Layers size={14} className={c.toggleIcon} aria-hidden="true" />
                <div>
                  <span className={c.fixedPriceTitle}>Este producto tiene tallas o colores</span>
                  <span className={c.fixedPriceSub}>El cajero elige la talla o el color al vender.</span>
                </div>
              </div>
              <label className={c.toggle} aria-label="Este producto tiene tallas o colores">
                <input
                  type="checkbox"
                  className={c.toggleInput}
                  checked={f.hasVariants}
                  onChange={(e) => {
                    f.setHasVariants(e.target.checked)
                  }}
                />
                <span className={c.toggleTrack} />
                <span className={c.toggleThumb} />
              </label>
            </div>

            {showSizeHint && (
              <div className={c.sizeHint} role="note">
                <p className={c.sizeHintText}>
                  {selectedCategoryName ? `"${selectedCategoryName}"` : 'Esta categoría'} normalmente se vende por talla.
                  Este producto todavía no tiene tallas.
                </p>
                <button type="button" className={c.sizeHintBtn} onClick={() => f.setHasVariants(true)}>
                  Activar tallas
                </button>
              </div>
            )}

            {f.hasVariants && f.isEdit && <VariantEditor f={f} />}

            {f.hasVariants && !f.isEdit && (
              <div className={c.variantsSection}>
                <label className={s.combineToggleRow}>
                  <input
                    type="checkbox"
                    checked={f.combineVariants}
                    onChange={(e) => f.setCombineVariants(e.target.checked)}
                  />
                  <span>Combinar dos tipos (ej. Talla + Color)</span>
                </label>

                {f.combineVariants ? (
                  <div className={s.combineSection}>
                    <div className={s.combineDim}>
                      <p className={c.sectionLabel}>Tallas</p>
                      <div className={c.variantAddRow}>
                        <input
                          type="text"
                          className={`${m.input} ${c.variantNameInput}`}
                          placeholder="Ej: S, M, L"
                          value={f.dim1Input}
                          onChange={(e) => f.setDim1Input(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.addDim1Value() } }}
                          maxLength={30}
                        />
                        <button
                          type="button"
                          className={c.variantAddBtn}
                          onClick={f.addDim1Value}
                          disabled={!f.dim1Input.trim()}
                          aria-label="Añadir talla"
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                      {f.dim1Values.length > 0 && (
                        <div className={c.presetGroup}>
                          {f.dim1Values.map((v, i) => (
                            <button
                              key={v}
                              type="button"
                              className={c.presetBtnActive}
                              onClick={() => f.removeDim1Value(i)}
                              aria-label={`Quitar talla ${v}`}
                            >
                              {v} <X size={11} aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={s.combineDim}>
                      <p className={c.sectionLabel}>Colores</p>
                      <div className={c.variantAddRow}>
                        <input
                          type="text"
                          className={`${m.input} ${c.variantNameInput}`}
                          placeholder="Ej: Azul, Rojo"
                          value={f.dim2Input}
                          onChange={(e) => f.setDim2Input(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.addDim2Value() } }}
                          maxLength={30}
                        />
                        <button
                          type="button"
                          className={c.variantAddBtn}
                          onClick={f.addDim2Value}
                          disabled={!f.dim2Input.trim()}
                          aria-label="Añadir color"
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                      {f.dim2Values.length > 0 && (
                        <div className={c.presetGroup}>
                          {f.dim2Values.map((v, i) => (
                            <button
                              key={v}
                              type="button"
                              className={c.presetBtnActive}
                              onClick={() => f.removeDim2Value(i)}
                              aria-label={`Quitar color ${v}`}
                            >
                              {v} <X size={11} aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={s.generateCombosBtn}
                      onClick={f.generateCombinations}
                      disabled={!f.dim1Values.length || !f.dim2Values.length}
                    >
                      Generar combinaciones
                    </button>

                    {f.combinations.length > 0 && (
                      <div className={s.comboTableWrap}>
                        <table className={s.comboTable}>
                          <thead>
                            <tr>
                              <th className={s.comboTh}>Combinación</th>
                              <th className={s.comboTh}>Stock</th>
                              <th className={s.comboTh}>Precio extra</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.combinations.map((combo) => (
                              <tr key={combo.key}>
                                <td className={s.comboTd}>{combo.key.replace('-', ' - ')}</td>
                                <td className={s.comboTd}>
                                  <input
                                    type="number"
                                    className={`${m.input} ${combo.stock === '0' ? s.comboStockZero : ''}`}
                                    value={combo.stock}
                                    onChange={(e) => f.updateCombinationStock(combo.key, e.target.value)}
                                    min="0"
                                    step="1"
                                    aria-label={`Stock de ${combo.key}`}
                                  />
                                </td>
                                <td className={s.comboTd}>
                                  <input
                                    type="number"
                                    className={m.input}
                                    value={combo.extra}
                                    onChange={(e) => f.updateCombinationExtra(combo.key, e.target.value)}
                                    min="0"
                                    step="0.01"
                                    aria-label={`Precio extra de ${combo.key}`}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {f.combinations.some(cb => cb.stock === '0') && (
                          <p className={s.variantStockWarning}>
                            Hay combinaciones con stock en 0 — quedarán marcadas como agotadas.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <VariantEditor f={f} />
                )}
              </div>
            )}
          </section>
        )}

      </div>

      <div role="tabpanel" id={tabPanelId('avanzado')} aria-labelledby={tabButtonId('avanzado')} hidden={tab !== 'avanzado'} className={s.panel}>
        {/* ── Card: Detalles internos — ubicación y notas, SIN toggle propio
            (siempre visibles dentro del body una vez expandida la card;
            son 2 campos simples, no necesitan ocultarse entre sí). ── */}
        <AccordionCard title="Detalles internos" defaultOpen={false}>
          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-location">
              <MapPin size={13} className={c.toggleIcon} aria-hidden="true" />
              Ubicación (opcional)
            </label>
            <input
              id="np-location"
              type="text"
              className={m.input}
              placeholder="Ej: Pasillo 3, Estante B"
              value={f.location}
              onChange={(e) => f.setLocation(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className={m.formGroup}>
            <label className={m.label} htmlFor="np-notes">Notas (opcional)</label>
            <textarea
              id="np-notes"
              className={m.textarea}
              placeholder="Información interna del producto..."
              value={f.productNotes}
              onChange={(e) => f.setProductNotes(e.target.value)}
              rows={2}
            />
          </div>
        </AccordionCard>
      </div>

      {f.errors.submit && <p className={m.errorMsg}>{f.errors.submit}</p>}

      {/* ── Overlays (dependientes de f) ── */}
      <CatalogUpgradeModal
        open={f.showCatalogUpgrade}
        onClose={() => f.setShowCatalogUpgrade(false)}
      />

      {f.isScanning && (
        <div className={c.scanOverlay} role="dialog" aria-label="Escáner de código de barras" aria-modal="true">
          <div ref={f.videoContainerRef} className={c.scanVideo} />
          <div className={c.scanFrame} aria-hidden="true" />
          {f.permError && (
            <p className={c.scanError}>Sin acceso a la cámara. Verifica los permisos del navegador.</p>
          )}
          <button
            type="button"
            className={c.scanClose}
            onClick={() => f.setIsScanning(false)}
            aria-label="Cerrar escáner"
          >
            <X size={18} aria-hidden="true" />
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}
