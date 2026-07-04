'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, X, Plus, ImagePlus, Loader2, Layers, Globe, Star,
  Box, Scale, Wrench, Boxes, Search, ScanBarcode,
} from 'lucide-react'
import { useProductForm, UNIDADES, type ProductKind } from '@/hooks/useProductForm'
import { CategoryModal } from '@/components/products/CategoryModal'
import { CatalogUpgradeModal } from '@/components/products/CatalogUpgradeModal'
import type { ProductFormData, ModalCategory } from '@/components/products/ProductModal'
import m from '@/components/products/modals.module.css'
import c from '@/components/products/ProductModal.module.css'
import s from './NuevoProducto.module.css'

/* ── Constantes presentacionales (idénticas a las del modal) ── */

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

const PRESET_GROUPS = [
  { id: 'ropa-adulto', label: 'Ropa adulto', values: ['XS','S','M','L','XL','XXL','XXXL'] },
  { id: 'ropa-nino',   label: 'Ropa niño',   values: ['2','4','6','8','10','12','14','16'] },
  { id: 'zap-adulto',  label: 'Zapato ad.',  values: ['35','36','37','38','39','40','41','42','43','44'] },
  { id: 'zap-nino',    label: 'Zapato niño', values: ['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'] },
  { id: 'colores',     label: 'Colores',     values: ['Negro','Blanco','Rojo','Azul','Verde','Amarillo','Naranja','Rosado','Gris','Morado'] },
] as const

const FORM_ID = 'nuevo-producto-form'

export default function NuevoProductoPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<ModalCategory[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)

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

  const f = useProductForm({ onSave: handleSave })

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
        {/* ══ Columna izquierda ══ */}
        <div className={s.column}>

          {/* ── Card: Información básica ── */}
          <section className={s.card}>
            <h2 className={s.cardTitle}>Información básica</h2>

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

            {/* Código de barras */}
            <div className={m.formGroup}>
              <label className={m.label} htmlFor="np-barcode">Código de Barras</label>
              <div className={c.barcodeRow}>
                <input
                  id="np-barcode"
                  type="text"
                  inputMode="text"
                  className={m.input}
                  placeholder="EAN-13, QR, SKU..."
                  value={f.barcode}
                  onChange={(e) => f.setBarcode(e.target.value)}
                  maxLength={60}
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
            </div>
          </section>

          {/* ── Card: Imágenes ── */}
          <section className={s.card}>
            <h2 className={s.cardTitle}>Imágenes</h2>
            <div className={c.imgGrid}>
              {([0, 1, 2] as const).map((slot) => (
                <div key={slot} className={`${c.imgSlot} ${f.images[slot] ? c.imgSlotFilled : ''}`}>
                  <input
                    ref={f.imgRefs[slot]}
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
                      onClick={() => f.imgRefs[slot].current?.click()}
                    >
                      <ImagePlus size={18} aria-hidden="true" />
                      <span>Foto {slot + 1}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {f.imgError && <p className={m.errorMsg}>{f.imgError}</p>}
          </section>
        </div>

        {/* ══ Columna derecha ══ */}
        <div className={s.column}>

          {/* ── Card: Precio ── */}
          <section className={s.card}>
            <h2 className={s.cardTitle}>Precio</h2>

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

            <div className={m.divider} />

            {/* Toggle precio fijo */}
            <div className={c.fixedPriceRow}>
              <div className={c.fixedPriceLabel}>
                <span className={c.fixedPriceTitle}>Usar Precios Fijos (Manuales)</span>
                <span className={c.fixedPriceSub}>
                  {f.isFixedPrice
                    ? 'Precio editable — margen se calcula automáticamente.'
                    : 'Precio calculado según el margen ingresado.'}
                </span>
              </div>
              <label className={c.toggle} aria-label="Activar precio fijo">
                <input
                  type="checkbox"
                  className={c.toggleInput}
                  checked={f.isFixedPrice}
                  onChange={(e) => {
                    const on = e.target.checked
                    f.setIsFixedPrice(on)
                    if (on && f.computed.displayPrice > 0) f.setPrice(f.computed.displayPrice.toFixed(2))
                  }}
                />
                <span className={c.toggleTrack} />
                <span className={c.toggleThumb} />
              </label>
            </div>

            {/* Margen + Precio */}
            <div className={c.inlineRow2}>
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

              <div className={m.formGroup}>
                <label className={m.label} htmlFor="np-price">Precio Venta ($)</label>
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
            </div>

            {/* Utilidad estimada */}
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
          </section>

          {/* ── Card: Inventario ── */}
          {f.saleMode !== 'service' && (
            <section className={s.card}>
              <h2 className={s.cardTitle}>Inventario</h2>

              <div className={m.formGroup}>
                <label className={m.label} htmlFor="np-stock">Stock Inicial</label>
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

              {(f.productKind === 'simple' || f.productKind === 'weight') && (
                <>
                  <div className={m.divider} />

                  {/* Toggle variantes */}
                  <div className={c.fixedPriceRow}>
                    <div className={c.fixedPriceLabel}>
                      <Layers size={14} className={c.toggleIcon} aria-hidden="true" />
                      <div>
                        <span className={c.fixedPriceTitle}>Tiene variantes (tallas/colores)</span>
                        <span className={c.fixedPriceSub}>El cajero elige variante antes de vender</span>
                      </div>
                    </div>
                    <label className={c.toggle} aria-label="Tiene variantes">
                      <input
                        type="checkbox"
                        className={c.toggleInput}
                        checked={f.hasVariants}
                        onChange={(e) => {
                          f.setHasVariants(e.target.checked)
                          if (!e.target.checked) f.setSelectedPresetGroup(null)
                        }}
                      />
                      <span className={c.toggleTrack} />
                      <span className={c.toggleThumb} />
                    </label>
                  </div>

                  {f.hasVariants && (
                    <div className={c.variantsSection}>
                      <p className={c.sectionLabel}>Elige un tipo</p>
                      <div className={c.presetGroupSelector}>
                        {PRESET_GROUPS.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className={`${c.presetGroupBtn} ${f.selectedPresetGroup === g.id ? c.presetGroupBtnActive : ''}`}
                            onClick={() => f.setSelectedPresetGroup(prev => prev === g.id ? null : g.id)}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>

                      {f.selectedPresetGroup && (
                        <div className={c.presetGroup}>
                          {PRESET_GROUPS.find(g => g.id === f.selectedPresetGroup)?.values.map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={`${c.presetBtn} ${f.variants.some(va => va.name === v) ? c.presetBtnActive : ''}`}
                              onClick={() => f.addPreset(v)}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}

                      {f.variants.length > 0 && (
                        <div className={c.variantList}>
                          {f.variants.map((v, i) => (
                            <div key={i} className={c.variantRow}>
                              <span className={c.variantRowName}>{v.name}</span>
                              {v.price_extra_usd > 0 && (
                                <span className={c.variantRowExtra}>+${v.price_extra_usd.toFixed(2)}</span>
                              )}
                              <button
                                type="button"
                                className={c.variantRemoveBtn}
                                onClick={() => f.removeVariant(i)}
                                aria-label={`Eliminar variante ${v.name}`}
                              >
                                <X size={13} aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={c.variantAddRow}>
                        <input
                          type="text"
                          className={`${m.input} ${c.variantNameInput}`}
                          placeholder="Nombre personalizado (ej: Talla M, Rojo)"
                          value={f.newVarName}
                          onChange={(e) => f.setNewVarName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); f.addVariant() } }}
                          maxLength={60}
                        />
                        <input
                          type="number"
                          className={`${m.input} ${c.variantExtraInput}`}
                          placeholder="+$0.00"
                          value={f.newVarExtra}
                          onChange={(e) => f.setNewVarExtra(e.target.value)}
                          min="0"
                          step="0.01"
                          aria-label="Precio extra USD"
                        />
                        <button
                          type="button"
                          className={c.variantAddBtn}
                          onClick={f.addVariant}
                          disabled={!f.newVarName.trim()}
                          aria-label="Añadir variante"
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ── Card: Catálogo ── */}
          <section className={s.card}>
            <h2 className={s.cardTitle}>Catálogo</h2>

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
              <button type="button" className={c.newCategoryBtn} onClick={() => setShowCategoryModal(true)}>
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
          </section>

          {f.errors.submit && <p className={m.errorMsg}>{f.errors.submit}</p>}
        </div>
      </form>

      {/* ── Modales / overlays ── */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
      />

      <CatalogUpgradeModal
        open={f.showCatalogUpgrade}
        onClose={() => f.setShowCatalogUpgrade(false)}
      />

      {/* Escáner de barras */}
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
    </div>
  )
}
