'use client'

import { useState } from 'react'
import { Camera, Check, Plus, Trash2 } from 'lucide-react'
import { SIZE_TYPES } from '@/lib/variantPresets'
import { sizeInfo } from '@/lib/size-guide'
import type { useProductForm } from '@/hooks/useProductForm'
import type { SizeType, VariantRow } from '@/types/variantForm'
import s from './VariantEditor.module.css'

type ProductForm = ReturnType<typeof useProductForm>

interface VariantEditorProps {
  f: ProductForm
}

/** "US 8.5 · 26.5 cm" para calzado; null si la talla no tiene dato publicado. */
function equivalenceText(row: VariantRow): string | null {
  if (!row.group || !row.group.startsWith('zap-')) return null
  const info = sizeInfo(row.group, row.valor)
  if (!info) return null
  return `US ${info.equivalent}${info.cm != null ? ` · ${info.cm} cm` : ''}`
}

/**
 * Editor de tallas/colores en 3 pasos: tipo -> tocar tallas -> tabla con stock, código de barras,
 * SKU y precio propio. Sirve igual en alta (filas en memoria) y en edición (filas de la DB).
 */
export function VariantEditor({ f }: VariantEditorProps) {
  const [extra, setExtra] = useState('')
  const [allStock, setAllStock] = useState('')

  const type: SizeType | null = SIZE_TYPES.find(t => t.id === f.sizeTypeId) ?? null
  const taken = new Set(f.rows.map(r => r.valor.toLowerCase()))
  const basePrice = f.computed.displayPrice

  const addExtra = () => {
    if (type && f.addSize(type, extra)) setExtra('')
  }

  return (
    <div className={s.root}>
      <section className={s.step} aria-labelledby="ve-step1">
        <h3 id="ve-step1" className={s.stepTitle}><span className={s.stepNum}>1</span>¿Qué tipo de talla es?</h3>
        <div className={s.types} role="group" aria-labelledby="ve-step1">
          {SIZE_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${s.typeBtn} ${f.sizeTypeId === t.id ? s.typeBtnActive : ''}`}
              aria-pressed={f.sizeTypeId === t.id}
              onClick={() => f.setSizeTypeId(t.id)}
            >
              <span className={s.typeLabel}>{t.label}</span>
              <span className={s.typeHint}>{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {type && (
        <section className={s.step} aria-labelledby="ve-step2">
          <h3 id="ve-step2" className={s.stepTitle}>
            <span className={s.stepNum}>2</span>
            {type.custom ? 'Escribe cada talla o variante' : 'Toca las que tienes'}
          </h3>

          {!type.custom && (
            <div className={s.chips}>
              {type.values.map(v => {
                const on = taken.has(v.toLowerCase())
                const eq = type.group?.startsWith('zap-') ? sizeInfo(type.group, v) : null
                return (
                  <button
                    key={v}
                    type="button"
                    className={`${s.chip} ${on ? s.chipOn : ''}`}
                    aria-pressed={on}
                    onClick={() => f.addSize(type, v)}
                  >
                    <span className={s.chipMain}>
                      {on && <Check size={14} aria-hidden="true" />}
                      {v}
                    </span>
                    {eq && <span className={s.chipSub}>US {eq.equivalent}</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className={s.extraRow}>
            <label className={s.field}>
              <span className={s.label}>{type.custom ? 'Nombre' : '¿Falta una? Escríbela'}</span>
              <input
                type="text"
                className={s.input}
                value={extra}
                maxLength={50}
                placeholder={type.custom ? 'Ej: Grande, Azul, 500 ml' : 'Ej: 52'}
                onChange={e => setExtra(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtra() } }}
              />
            </label>
            <button type="button" className={s.addBtn} onClick={addExtra} disabled={!extra.trim()}>
              <Plus size={16} aria-hidden="true" />
              Agregar
            </button>
          </div>
        </section>
      )}

      {f.loadingDbVars && <p className={s.help}>Cargando tallas guardadas…</p>}

      {f.rows.length > 0 && (
        <section className={s.step} aria-labelledby="ve-step3">
          <h3 id="ve-step3" className={s.stepTitle}><span className={s.stepNum}>3</span>Cuántas tienes de cada una</h3>
          <p className={s.help}>
            Cada talla puede tener su propio código de barras: al escanearlo en la caja se vende esa talla.
          </p>

          <div className={s.bulk}>
            <label className={s.field}>
              <span className={s.label}>Mismo stock para todas</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={s.input}
                value={allStock}
                placeholder="Ej: 5"
                onChange={e => setAllStock(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={s.secondaryBtn}
              disabled={allStock.trim() === ''}
              onClick={() => { f.setAllStock(String(Math.max(parseInt(allStock) || 0, 0))); setAllStock('') }}
            >
              Aplicar a todas
            </button>
            <p className={s.total} aria-live="polite">Stock total: <strong>{f.variantStockTotal} und</strong></p>
          </div>

          <div className={s.table} role="table" aria-label="Tallas del producto">
            <div className={s.headRow} role="row">
              <span role="columnheader">Talla</span>
              <span role="columnheader">Stock</span>
              <span role="columnheader">Código de barras</span>
              <span role="columnheader">SKU (opcional)</span>
              <span role="columnheader">Precio propio (opcional)</span>
              <span role="columnheader" className={s.srOnly}>Quitar</span>
            </div>

            {f.rows.map(r => {
              const eq = equivalenceText(r)
              const errId = `ve-err-${r.key}`
              return (
                <div key={r.key} className={s.row} role="row">
                  <div className={s.cellName} role="cell">
                    <span className={s.rowName}>{r.valor}</span>
                    {eq && <span className={s.rowEq}>{eq}</span>}
                  </div>

                  <label className={s.field} role="cell">
                    <span className={`${s.label} ${s.cellLabel}`}>Stock</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      className={s.input}
                      value={r.stock}
                      onChange={e => f.updateRow(r.key, { stock: e.target.value })}
                    />
                  </label>

                  <div className={s.field} role="cell">
                    <label htmlFor={`ve-bc-${r.key}`} className={`${s.label} ${s.cellLabel}`}>Código de barras</label>
                    <div className={s.scanRow}>
                      <input
                        id={`ve-bc-${r.key}`}
                        type="text"
                        inputMode="numeric"
                        className={`${s.input} ${r.barcodeError ? s.inputError : ''}`}
                        value={r.barcode}
                        maxLength={50}
                        placeholder="Escanea o escribe"
                        aria-invalid={r.barcodeError ? true : undefined}
                        aria-describedby={r.barcodeError ? errId : undefined}
                        onChange={e => f.updateRow(r.key, { barcode: e.target.value })}
                        onBlur={() => void f.checkBarcode(r.key)}
                      />
                      <button
                        type="button"
                        className={s.iconBtn}
                        aria-label={`Escanear código de la talla ${r.valor} con la cámara`}
                        onClick={() => f.startRowScan(r.key)}
                      >
                        <Camera size={18} aria-hidden="true" />
                      </button>
                    </div>
                    {r.barcodeError && <p id={errId} className={s.error} role="alert">{r.barcodeError}</p>}
                  </div>

                  <label className={s.field} role="cell">
                    <span className={`${s.label} ${s.cellLabel}`}>SKU (opcional)</span>
                    <input
                      type="text"
                      className={s.input}
                      value={r.sku}
                      maxLength={50}
                      placeholder="Tu código interno"
                      onChange={e => f.updateRow(r.key, { sku: e.target.value })}
                    />
                  </label>

                  <label className={s.field} role="cell">
                    <span className={`${s.label} ${s.cellLabel}`}>Precio propio (opcional)</span>
                    <span className={s.priceWrap}>
                      <span className={s.currency} aria-hidden="true">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className={`${s.input} ${s.priceInput}`}
                        value={r.price}
                        placeholder={basePrice > 0 ? basePrice.toFixed(2) : 'Igual al producto'}
                        onChange={e => f.updateRow(r.key, { price: e.target.value })}
                      />
                    </span>
                  </label>

                  <button
                    type="button"
                    className={s.removeBtn}
                    aria-label={`Quitar talla ${r.valor}`}
                    onClick={() => f.removeRow(r.key)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                    <span className={s.removeText}>Quitar</span>
                  </button>
                </div>
              )
            })}
          </div>

          <p className={s.help}>
            Precio propio: déjalo vacío para cobrar el precio del producto
            {basePrice > 0 ? ` ($${basePrice.toFixed(2)})` : ''}. Escríbelo solo si esa talla cuesta distinto.
          </p>
        </section>
      )}

      {f.errors.variants && <p className={s.error} role="alert">{f.errors.variants}</p>}
    </div>
  )
}
