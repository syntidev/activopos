'use client'

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { SIZES } from '@/lib/label-capture-shared'
import type { LabelCaptureDTO, LabelCapturePatch } from '@/types/label-capture'
import styles from './captura.module.css'

interface EditSheetProps {
  item: LabelCaptureDTO
  saving: boolean
  error: string
  onClose: () => void
  onSave: (patch: LabelCapturePatch) => void
}

/** Hoja de edición por registro. Solo envía los campos que cambiaron. */
export function EditSheet({ item, saving, error, onClose, onSave }: EditSheetProps) {
  const [ean, setEan] = useState(item.ean)
  const [ref, setRef] = useState(item.ref)
  const [modelName, setModelName] = useState(item.model_name)
  const [labelColor, setLabelColor] = useState(item.label_color)
  const [size, setSize] = useState(item.size)
  const [units, setUnits] = useState(String(item.units))
  const [colorActual, setColorActual] = useState(item.color_actual ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')

  function submit(e: FormEvent): void {
    e.preventDefault()
    const patch: LabelCapturePatch = {}
    if (ean !== item.ean) patch.ean = ean
    if (ref !== item.ref) patch.ref = ref
    if (modelName !== item.model_name) patch.model_name = modelName
    if (labelColor !== item.label_color) patch.label_color = labelColor
    if (size !== item.size) patch.size = size
    if (Number(units) !== item.units) patch.units = Number(units)
    if (colorActual !== (item.color_actual ?? '')) patch.color_actual = colorActual || null
    if (notes !== (item.notes ?? '')) patch.notes = notes || null
    onSave(patch)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Editar etiqueta">
      <form className={styles.sheet} onSubmit={submit}>
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Editar {item.ref || 'etiqueta'}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className={styles.readOnly}>
          <span>Prenda: {item.garment || '—'}</span>
          <span>Género: {item.gender || '—'}</span>
          <span className={item.status === 'ok' ? styles.badgeOk : styles.badgeReview}>
            {item.status === 'ok' ? 'OK' : 'Por revisar'}
          </span>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>EAN (13 dígitos)</span>
          <input className={styles.input} value={ean} inputMode="numeric" maxLength={13} onChange={e => setEan(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Referencia</span>
          <input className={styles.input} value={ref} maxLength={10} onChange={e => setRef(e.target.value.toUpperCase())} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Modelo</span>
          <input className={styles.input} value={modelName} maxLength={120} onChange={e => setModelName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Color de la etiqueta</span>
          <input className={styles.input} value={labelColor} maxLength={40} onChange={e => setLabelColor(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Talla</span>
          <select className={styles.input} value={size} onChange={e => setSize(e.target.value)}>
            <option value="">Sin talla</option>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Unidades</span>
          <input className={styles.input} type="number" min={1} max={9999} value={units} inputMode="numeric" onChange={e => setUnits(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Color real (lo escribes tú)</span>
          <input className={styles.input} value={colorActual} maxLength={60} onChange={e => setColorActual(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Notas</span>
          <textarea className={styles.input} rows={3} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.sheetActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
