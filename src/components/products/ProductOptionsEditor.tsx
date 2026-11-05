'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { confirmAction } from '@/context/ConfirmContext'
import type { ProductOptionGroupDTO, ProductOptionsResponse } from '@/types/product-options'
import styles from './ProductOptionsEditor.module.css'

interface ProductOptionsEditorProps { productId: number }

/** Estado de edición: claves locales para React y campos numéricos como texto (se validan al guardar). */
interface OptionDraft { key: string; id?: number; name: string; price: string; active: boolean }
interface GroupDraft { key: string; id?: number; name: string; required: boolean; multiple: boolean; maxSelect: string; active: boolean; options: OptionDraft[] }

const MAX_GROUPS = 20
const MAX_OPTIONS = 30

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function toDrafts(groups: ProductOptionGroupDTO[], uid: () => string): GroupDraft[] {
  return groups.map(g => ({
    key: uid(), id: g.id, name: g.name, required: g.required, multiple: g.multiple, maxSelect: g.max_select === null ? '' : String(g.max_select), active: g.is_active,
    options: g.options.map(o => ({ key: uid(), id: o.id, name: o.name, price: o.price_extra_usd === 0 ? '' : String(o.price_extra_usd), active: o.is_active })),
  }))
}

/** El estado sin las claves locales: sirve para saber si hay cambios sin guardar. */
function snapshot(groups: GroupDraft[]): string {
  return JSON.stringify(groups.map(({ key: _k, options, ...g }) => ({ ...g, options: options.map(({ key: _o, ...o }) => o) })))
}

/** Lo que viaja al servidor, o el mensaje de lo que falta (validación rápida; el servidor vuelve a validar todo). */
function toPayload(groups: GroupDraft[]): { groups: ProductOptionGroupDTO[] } | { error: string } {
  const out: ProductOptionGroupDTO[] = []
  for (const g of groups) {
    const gname = g.name.trim()
    if (!gname) return { error: 'Cada grupo necesita un nombre.' }
    if (g.options.length === 0) return { error: `"${gname}" necesita al menos una opción.` }
    const max = g.multiple && g.maxSelect.trim() !== '' ? Number(g.maxSelect) : null
    if (max !== null && (!Number.isInteger(max) || max < 1)) return { error: `"${gname}": el tope debe ser un entero desde 1.` }
    const options = []
    for (const o of g.options) {
      const name = o.name.trim()
      if (!name) return { error: `"${gname}": hay una opción sin nombre.` }
      const price = o.price.trim() === '' ? 0 : Number(o.price.replace(',', '.'))
      if (!Number.isFinite(price) || price < 0) return { error: `"${gname}" › ${name}: el extra debe ser un número desde 0.` }
      options.push({ ...(o.id !== undefined ? { id: o.id } : {}), name, price_extra_usd: Math.round(price * 100) / 100, is_active: o.active })
    }
    out.push({ ...(g.id !== undefined ? { id: g.id } : {}), name: gname, required: g.required, multiple: g.multiple, max_select: max, is_active: g.active, options })
  }
  return { groups: out }
}

/**
 * Editor de grupos de opciones de un producto ("Tocineta: Pavo / Cochino", extras con precio…). Guarda con su propio PUT
 * (reemplazo completo, igual que Colecciones). Quitar un grupo u opción pide confirmación; el borrado se aplica al guardar.
 */
export function ProductOptionsEditor({ productId }: ProductOptionsEditorProps) {
  const seq = useRef(0)
  const uid = useCallback((): string => `k${++seq.current}`, [])
  const [groups, setGroups] = useState<GroupDraft[] | null>(null)
  const [initial, setInitial] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const apply = useCallback((serverGroups: ProductOptionGroupDTO[]) => {
    const drafts = toDrafts(serverGroups, uid)
    setGroups(drafts)
    setInitial(snapshot(drafts))
  }, [uid])

  useEffect(() => {
    let alive = true
    fetch(`/api/products/${productId}/options`, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json() as ProductOptionsResponse & { error?: string }
        if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar las opciones')
        if (alive) apply(j.groups)
      })
      .catch((e: unknown) => { if (alive) setLoadError(e instanceof Error ? e.message : 'No se pudieron cargar las opciones') })
    return () => { alive = false }
  }, [productId, apply])

  if (loadError) return <p className={styles.error} role="alert">{loadError}</p>
  if (!groups) return <p className={styles.muted}>Cargando opciones…</p>

  const dirty = snapshot(groups) !== initial
  const patchGroup = (i: number, p: Partial<GroupDraft>): void => { setSaved(false); setGroups(groups.map((g, k) => (k === i ? { ...g, ...p } : g))) }
  const patchOption = (gi: number, oi: number, p: Partial<OptionDraft>): void => patchGroup(gi, { options: groups[gi].options.map((o, k) => (k === oi ? { ...o, ...p } : o)) })

  const addGroup = (): void => {
    setSaved(false)
    setGroups([...groups, { key: uid(), name: '', required: false, multiple: false, maxSelect: '', active: true, options: [{ key: uid(), name: '', price: '', active: true }] }])
  }

  const removeGroup = async (i: number): Promise<void> => {
    const g = groups[i]
    const n = g.options.length
    const ok = await confirmAction({
      title: '¿Eliminar este grupo de opciones?',
      message: <>Se quitará <strong>{g.name.trim() || 'el grupo'}</strong> con sus {n} {n === 1 ? 'opción' : 'opciones'} del producto cuando guardes.</>,
      confirmLabel: 'Eliminar grupo',
    })
    if (ok) { setSaved(false); setGroups(groups.filter((_, k) => k !== i)) }
  }

  const removeOption = async (gi: number, oi: number): Promise<void> => {
    const o = groups[gi].options[oi]
    const ok = await confirmAction({
      title: '¿Eliminar esta opción?',
      message: <>Se quitará <strong>{o.name.trim() || 'la opción'}</strong> de «{groups[gi].name.trim() || 'el grupo'}» cuando guardes.</>,
      confirmLabel: 'Eliminar opción',
    })
    if (ok) patchGroup(gi, { options: groups[gi].options.filter((_, k) => k !== oi) })
  }

  const save = async (): Promise<void> => {
    const payload = toPayload(groups)
    if ('error' in payload) { setError(payload.error); setSaved(false); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/products/${productId}/options`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json() as ProductOptionsResponse & { error?: string }
      if (!res.ok) { setError(j.error ?? 'No se pudo guardar.'); setSaved(false); return }
      apply(j.groups)
      setSaved(true)
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.root} data-testid="options-editor">
      <h2 className={styles.title}>Opciones del producto</h2>
      <p className={styles.hint}>
        Grupos que el cliente elige al pedir este plato (por ejemplo «Tocineta»: Pavo o Cochino). Pueden ser obligatorios, de una o varias
        opciones, y cada opción puede sumar un extra en USD.
      </p>

      {groups.length === 0 && <p className={styles.muted}>Este producto aún no tiene grupos de opciones.</p>}

      {groups.map((g, gi) => (
        <section key={g.key} className={styles.group} aria-label={`Grupo ${g.name || gi + 1}`} data-testid="option-group">
          <div className={styles.groupHead}>
            <input className={`${styles.input} ${styles.groupName}`} value={g.name} maxLength={60} placeholder="Nombre del grupo (ej. Tocineta)"
              aria-label={`Nombre del grupo ${gi + 1}`} onChange={e => patchGroup(gi, { name: e.target.value })} />
            <button type="button" className={styles.iconBtn} aria-label={`Subir grupo ${g.name || gi + 1}`} disabled={gi === 0}
              onClick={() => { setSaved(false); setGroups(move(groups, gi, gi - 1)) }}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" className={styles.iconBtn} aria-label={`Bajar grupo ${g.name || gi + 1}`} disabled={gi === groups.length - 1}
              onClick={() => { setSaved(false); setGroups(move(groups, gi, gi + 1)) }}><ArrowDown size={18} aria-hidden="true" /></button>
            <button type="button" className={`${styles.iconBtn} ${styles.danger}`} aria-label={`Eliminar grupo ${g.name || gi + 1}`}
              onClick={() => { void removeGroup(gi) }}><Trash2 size={18} aria-hidden="true" /></button>
          </div>

          <div className={styles.flags}>
            <label className={styles.check}><input type="checkbox" checked={g.required} onChange={e => patchGroup(gi, { required: e.target.checked })} /> Obligatorio</label>
            <label className={styles.check}><input type="checkbox" checked={g.multiple} onChange={e => patchGroup(gi, { multiple: e.target.checked, maxSelect: e.target.checked ? g.maxSelect : '' })} /> Permitir varias</label>
            {g.multiple && (
              <label className={styles.maxField}>Máximo
                <input className={`${styles.input} ${styles.maxInput}`} inputMode="numeric" value={g.maxSelect} placeholder="sin tope" aria-label={`Máximo de opciones de ${g.name || `grupo ${gi + 1}`}`}
                  onChange={e => patchGroup(gi, { maxSelect: e.target.value.replace(/\D/g, '') })} />
              </label>
            )}
            <label className={styles.check}><input type="checkbox" checked={g.active} onChange={e => patchGroup(gi, { active: e.target.checked })} /> Activo</label>
          </div>

          <ul className={styles.options}>
            {g.options.map((o, oi) => (
              <li key={o.key} className={styles.option} data-testid="option-row">
                <input className={`${styles.input} ${styles.optName}`} value={o.name} maxLength={60} placeholder="Opción (ej. Pavo)"
                  aria-label={`Nombre de la opción ${oi + 1} de ${g.name || `grupo ${gi + 1}`}`} onChange={e => patchOption(gi, oi, { name: e.target.value })} />
                <input className={`${styles.input} ${styles.optPrice}`} inputMode="decimal" value={o.price} placeholder="Extra $ 0"
                  aria-label={`Extra en USD de ${o.name || `opción ${oi + 1}`}`} onChange={e => patchOption(gi, oi, { price: e.target.value.replace(/[^\d.,]/g, '') })} />
                <button type="button" className={styles.iconBtn} aria-label={`Subir opción ${o.name || oi + 1}`} disabled={oi === 0}
                  onClick={() => patchGroup(gi, { options: move(g.options, oi, oi - 1) })}><ArrowUp size={18} aria-hidden="true" /></button>
                <button type="button" className={styles.iconBtn} aria-label={`Bajar opción ${o.name || oi + 1}`} disabled={oi === g.options.length - 1}
                  onClick={() => patchGroup(gi, { options: move(g.options, oi, oi + 1) })}><ArrowDown size={18} aria-hidden="true" /></button>
                <button type="button" className={`${styles.iconBtn} ${styles.danger}`} aria-label={`Eliminar opción ${o.name || oi + 1}`}
                  onClick={() => { void removeOption(gi, oi) }}><Trash2 size={18} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.textBtn} disabled={g.options.length >= MAX_OPTIONS}
            onClick={() => patchGroup(gi, { options: [...g.options, { key: uid(), name: '', price: '', active: true }] })}>
            <Plus size={16} aria-hidden="true" /> Agregar opción
          </button>
        </section>
      ))}

      <div className={styles.footer}>
        <button type="button" className={styles.textBtn} disabled={groups.length >= MAX_GROUPS} onClick={addGroup} data-testid="option-add-group">
          <Plus size={16} aria-hidden="true" /> Agregar grupo
        </button>
        <button type="button" className={styles.textBtn} disabled={saving || !dirty} onClick={() => { void save() }} data-testid="option-save">
          {saving ? 'Guardando...' : 'Guardar opciones'}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {saved && !dirty && <p className={styles.ok} role="status">Opciones guardadas.</p>}
      </div>
    </div>
  )
}
