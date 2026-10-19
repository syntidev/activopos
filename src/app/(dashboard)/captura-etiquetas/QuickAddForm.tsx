'use client'

import { useRef, type ChangeEvent } from 'react'
import { Camera } from 'lucide-react'
import { formatBs, formatUsd, parseMoney } from '@/lib/quick-add-shared'
import type { QuickAddContext } from '@/types/quick-add'
import { TITLE_SOURCE_LABEL, type FormValues } from './quick-add-client'
import base from './captura.module.css'
import styles from './alta.module.css'

interface PriceFieldProps {
  label: string
  value: string
  rate: number
  onChange: (value: string) => void
}

/** Precio en USD con su equivalente en Bs justo debajo (siempre juntos). */
function PriceField({ label, value, rate, onChange }: PriceFieldProps) {
  const usd = parseMoney(value)
  return (
    <label className={base.field}>
      <span className={base.label}>{label}</span>
      <input className={base.input} value={value} inputMode="decimal" placeholder="0.00" onChange={e => onChange(e.target.value)} />
      {Number.isFinite(usd) && usd >= 0 && (
        <span className={styles.priceHint}>{formatUsd(usd)} · {formatBs(usd, rate)}</span>
      )}
    </label>
  )
}

interface QuickAddFormProps {
  code: string
  values: FormValues
  context: QuickAddContext
  busy: boolean
  canSave: boolean
  onChange: (patch: Partial<FormValues>) => void
  onTitlePhoto: (file: File) => void
  onSave: () => void
  onCancel: () => void
}

export function QuickAddForm({ code, values, context, busy, canSave, onChange, onTitlePhoto, onSave, onCancel }: QuickAddFormProps) {
  const photoRef = useRef<HTMLInputElement>(null)
  const price = parseMoney(values.price)
  const wholesale = parseMoney(values.wholesale)
  const wholesaleAbovePublic = Number.isFinite(price) && Number.isFinite(wholesale) && wholesale > price

  function pickPhoto(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onTitlePhoto(file)
  }

  return (
    <form className={styles.form} onSubmit={e => { e.preventDefault(); if (canSave) onSave() }}>
      <label className={base.field}>
        <span className={base.label}>Código de barras</span>
        <input className={base.input} value={code} readOnly aria-readonly="true" />
      </label>

      <div className={base.field}>
        <label className={base.label} htmlFor="qa-title">Título</label>
        <input id="qa-title" className={base.input} value={values.title} maxLength={120} onChange={e => onChange({ title: e.target.value, titleSource: values.titleSource })} />
        {values.titleSource && <span className={styles.sourceNote}>Fuente: {TITLE_SOURCE_LABEL[values.titleSource]}</span>}
        <input ref={photoRef} className={base.hiddenInput} type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
        <button type="button" className={base.secondaryButton} disabled={busy} onClick={() => photoRef.current?.click()}>
          <Camera size={18} /> Foto del título
        </button>
      </div>

      <div className={styles.twoCols}>
        <label className={base.field}>
          <span className={base.label}>Cantidad</span>
          <input className={base.input} value={values.quantity} inputMode="numeric" onChange={e => onChange({ quantity: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label className={base.field}>
          <span className={base.label}>Categoría</span>
          <select className={base.input} value={values.categoryId} onChange={e => onChange({ categoryId: e.target.value })}>
            <option value="">Elige una categoría</option>
            {context.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <label className={base.field}>
        <span className={base.label}>Subcategoría (opcional)</span>
        <input className={base.input} value={values.subcategory} maxLength={60} list="qa-subcategories" onChange={e => onChange({ subcategory: e.target.value })} />
        <datalist id="qa-subcategories">
          {context.subcategories.map(s => <option key={s} value={s} />)}
        </datalist>
      </label>

      <div className={styles.twoCols}>
        <PriceField label="Precio al público (USD)" value={values.price} rate={context.rate} onChange={v => onChange({ price: v })} />
        <PriceField label="Precio al mayor (USD)" value={values.wholesale} rate={context.rate} onChange={v => onChange({ wholesale: v })} />
      </div>
      {wholesaleAbovePublic && <p className={styles.warning} role="status">El precio al mayor es más alto que el del público. Revisa los precios.</p>}

      <div className={base.sheetActions}>
        <button type="button" className={base.secondaryButton} disabled={busy} onClick={onCancel}>Otro código</button>
        <button type="submit" className={base.primaryButton} disabled={busy || !canSave}>Guardar y siguiente</button>
      </div>
    </form>
  )
}
