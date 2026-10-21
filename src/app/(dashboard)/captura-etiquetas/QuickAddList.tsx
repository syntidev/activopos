'use client'

import { useState } from 'react'
import { formatBs, formatUsd, parseMoney } from '@/lib/quick-add-shared'
import type { QuickAddedItem } from '@/types/quick-add'
import base from './captura.module.css'
import styles from './alta.module.css'

export interface ItemChange {
  added: number
  price: number
  wholesale: number | null
}

interface RowProps {
  item: QuickAddedItem
  rate: number
  /** Devuelve '' si guardó, o el mensaje de error. */
  onSave: (item: QuickAddedItem, change: ItemChange) => Promise<string>
}

function PriceLine({ label, usd, rate }: { label: string; usd: number | null; rate: number }) {
  if (usd === null) return <span>{label}: —</span>
  return <span>{label}: {formatUsd(usd)} · {formatBs(usd, rate)}</span>
}

function ItemRow({ item, rate, onSave }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [added, setAdded] = useState(String(item.added))
  const [price, setPrice] = useState(String(item.price_usd ?? ''))
  const [wholesale, setWholesale] = useState(item.wholesale_usd === null ? '' : String(item.wholesale_usd))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addedN = Number(added)
  const priceN = parseMoney(price)
  const wholesaleN = parseMoney(wholesale)
  const valid = Number.isInteger(addedN) && addedN >= 0 && Number.isFinite(priceN) && priceN > 0 && (wholesale.trim() === '' || (Number.isFinite(wholesaleN) && wholesaleN >= 0))

  async function save(): Promise<void> {
    setSaving(true)
    const message = await onSave(item, { added: addedN, price: priceN, wholesale: wholesale.trim() === '' ? null : wholesaleN })
    setSaving(false)
    setError(message)
    if (!message) setEditing(false)
  }

  return (
    <li className={styles.itemRow}>
      <div className={styles.itemHead}>
        <span className={base.rowRef}>{item.name}</span>
        <span className={item.kind === 'created' ? base.badgeOk : base.badgeReview}>{item.kind === 'created' ? 'Nuevo' : 'Cantidad sumada'}</span>
      </div>
      <span className={base.rowMeta}>{item.barcode} · cargadas aquí: {item.added} · stock: {item.stock}</span>
      <div className={styles.itemPrices}>
        <PriceLine label="Público" usd={item.price_usd} rate={rate} />
        <PriceLine label="Divisa" usd={item.wholesale_usd} rate={rate} />
      </div>
      {!editing && (
        <button type="button" className={base.chip} onClick={() => setEditing(true)}>Corregir</button>
      )}
      {editing && (
        <div className={styles.itemEdit}>
          <label className={base.field}><span className={base.label}>Cantidad cargada aquí</span>
            <input className={base.input} value={added} inputMode="numeric" onChange={e => setAdded(e.target.value.replace(/\D/g, ''))} /></label>
          <label className={base.field}><span className={base.label}>Público (USD)</span>
            <input className={base.input} value={price} inputMode="decimal" onChange={e => setPrice(e.target.value)} /></label>
          <label className={base.field}><span className={base.label}>Divisa (USD)</span>
            <input className={base.input} value={wholesale} inputMode="decimal" onChange={e => setWholesale(e.target.value)} /></label>
          {error && <p className={base.error}>{error}</p>}
          <div className={base.sheetActions}>
            <button type="button" className={base.secondaryButton} disabled={saving} onClick={() => { setEditing(false); setError('') }}>Cancelar</button>
            <button type="button" className={base.primaryButton} disabled={saving || !valid} onClick={() => void save()}>Guardar cambios</button>
          </div>
        </div>
      )}
    </li>
  )
}

interface QuickAddListProps {
  items: QuickAddedItem[]
  rate: number
  onSave: RowProps['onSave']
}

/** Lo insertado o sumado en esta pestaña, con corrección de cantidad y precios. Sin borrado. */
export function QuickAddList({ items, rate, onSave }: QuickAddListProps) {
  if (items.length === 0) return <p className={base.empty}>Aún no hay productos en esta sesión. Escanea el primer código.</p>
  return (
    <ul className={base.list}>
      {items.map(i => <ItemRow key={`${i.id}-${i.added}-${i.price_usd}-${i.wholesale_usd}`} item={i} rate={rate} onSave={onSave} />)}
    </ul>
  )
}
