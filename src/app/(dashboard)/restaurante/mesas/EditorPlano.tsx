'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChefHat, Circle, CircleDot, DoorOpen, Minus, Plus, Square, Trash2, Wine } from 'lucide-react'
import { useToast } from '@/components/ui'
import { callApi } from '@/lib/restaurante-client'
import { GRID_MAX, freeSpot, renderedSize, type Box } from '@/lib/restaurante'
import type { DiningTableDTO, FloorElementDTO, FloorKind, ServiceAreaDTO, TableRotation, TableShape } from '@/types/restaurante'
import { PlanoSalon, planoExtent, type PickKind } from './PlanoSalon'
import styles from './editor.module.css'

interface EditorPlanoProps {
  area: ServiceAreaDTO
  tables: readonly DiningTableDTO[]
  elements: readonly FloorElementDTO[]
  onDirtyChange: (dirty: boolean) => void
  onDiscard: () => void
  /** Se llama cuando todo se guardó; el padre vuelve a leer el salón. */
  onSaved: () => Promise<void>
}

interface Sel { kind: PickKind; id: number }
interface Drag { kind: PickKind; id: number; startX: number; startY: number; origX: number; origY: number }

const ROTATIONS: readonly TableRotation[] = [0, 90, 180, 270]
const SHAPES: ReadonlyArray<{ value: TableShape; label: string }> = [
  { value: 'rect', label: 'Cuadrada' }, { value: 'round', label: 'Redonda' }, { value: 'stool', label: 'Taburete' },
]
const ELEMENT_DEFAULTS: Record<FloorKind, { width: number; height: number; label: string | null }> = {
  wall: { width: 6, height: 1, label: null },
  door: { width: 3, height: 1, label: null },
  bar:  { width: 2, height: 8, label: null },
  pass: { width: 6, height: 1, label: null },
}
const TABLE_KEYS = ['label', 'capacity', 'shape', 'pos_x', 'pos_y', 'width', 'height', 'rotation'] as const
const ELEMENT_KEYS = ['label', 'pos_x', 'pos_y', 'width', 'height', 'rotation'] as const

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

function boxesOf(rows: ReadonlyArray<{ pos_x: number; pos_y: number; width: number; height: number; rotation: number }>): Box[] {
  return rows.map(r => ({ x: r.pos_x, y: r.pos_y, ...renderedSize(r.width, r.height, r.rotation) }))
}

/** Siguiente número libre: 1 + el mayor número entre las etiquetas existentes. */
function nextLabel(tables: readonly DiningTableDTO[]): string {
  const nums = tables.map(t => Number.parseInt(t.label, 10)).filter(Number.isFinite)
  return String(nums.length ? Math.max(...nums) + 1 : 1)
}

/**
 * Editor de plano (solo admin). Arrastre con puntero o flechas con el teclado, ajuste a la cuadrícula.
 * Los cambios viven en un borrador local y se envían juntos con "Guardar plano".
 */
export function EditorPlano({ area, tables, elements, onDirtyChange, onDiscard, onSaved }: EditorPlanoProps) {
  const { toast } = useToast()
  const [draftTables, setDraftTables] = useState<DiningTableDTO[]>(() => tables.filter(t => t.active).map(t => ({ ...t })))
  const [draftElements, setDraftElements] = useState<FloorElementDTO[]>(() => elements.map(e => ({ ...e })))
  const [removed, setRemoved] = useState<{ tables: number[]; elements: number[] }>({ tables: [], elements: [] })
  const [sel, setSel] = useState<Sel | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const tempId = useRef(-1)

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  const extent = useMemo(() => planoExtent(draftTables, draftElements), [draftTables, draftElements])
  const selTable = sel?.kind === 'table' ? draftTables.find(t => t.id === sel.id) ?? null : null
  const selElement = sel?.kind === 'element' ? draftElements.find(e => e.id === sel.id) ?? null : null

  function touch(): void { setDirty(true) }

  function updateTable(id: number, patch: Partial<DiningTableDTO>): void {
    setDraftTables(rows => rows.map(t => (t.id === id ? { ...t, ...patch } : t)))
    touch()
  }
  function updateElement(id: number, patch: Partial<FloorElementDTO>): void {
    setDraftElements(rows => rows.map(e => (e.id === id ? { ...e, ...patch } : e)))
    touch()
  }

  function addTable(shape: TableShape): void {
    const size = shape === 'stool' ? 1 : 2
    const spot = freeSpot([...boxesOf(draftTables), ...boxesOf(draftElements)], size, size)
    const id = tempId.current--
    setDraftTables(rows => [...rows, {
      id, area_id: area.id, area_name: area.name, label: nextLabel(rows), capacity: shape === 'stool' ? 1 : 4, shape,
      pos_x: spot.x, pos_y: spot.y, width: size, height: size, rotation: 0, active: true,
      cleaning_pending: false, reserved_for: null, reserved_phone: null, reserved_at: null, status: 'libre',
      account_id: null, account_total_usd: null, account_total_bs: null, account_opened_at: null, ready_items: 0,
    }])
    setSel({ kind: 'table', id })
    touch()
  }

  function addElement(kind: FloorKind): void {
    const d = ELEMENT_DEFAULTS[kind]
    const spot = freeSpot([...boxesOf(draftTables), ...boxesOf(draftElements)], d.width, d.height)
    const id = tempId.current--
    setDraftElements(rows => [...rows, { id, area_id: area.id, kind, label: d.label, pos_x: spot.x, pos_y: spot.y, width: d.width, height: d.height, rotation: 0 }])
    setSel({ kind: 'element', id })
    touch()
  }

  function removeSelected(): void {
    if (!sel) return
    if (sel.kind === 'table') {
      setDraftTables(rows => rows.filter(t => t.id !== sel.id))
      if (sel.id > 0) setRemoved(r => ({ ...r, tables: [...r.tables, sel.id] }))
    } else {
      setDraftElements(rows => rows.filter(e => e.id !== sel.id))
      if (sel.id > 0) setRemoved(r => ({ ...r, elements: [...r.elements, sel.id] }))
    }
    setSel(null)
    touch()
  }

  /** Posición del puntero en celdas del plano. */
  function cellAt(e: PointerEvent): { x: number; y: number } {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 0, y: 0 }
    const scale = extent.cols / rect.width
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
  }

  function moveTo(kind: PickKind, id: number, x: number, y: number): void {
    const row = kind === 'table' ? draftTables.find(t => t.id === id) : draftElements.find(el => el.id === id)
    if (!row) return
    const s = renderedSize(row.width, row.height, row.rotation)
    const pos = { pos_x: clamp(Math.round(x), 0, GRID_MAX - s.w), pos_y: clamp(Math.round(y), 0, GRID_MAX - s.h) }
    if (kind === 'table') updateTable(id, pos); else updateElement(id, pos)
  }

  function onItemPointerDown(e: PointerEvent<SVGGElement>, kind: PickKind, id: number): void {
    if (e.button !== 0) return
    const row = kind === 'table' ? draftTables.find(t => t.id === id) : draftElements.find(el => el.id === id)
    if (!row) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = cellAt(e)
    drag.current = { kind, id, startX: p.x, startY: p.y, origX: row.pos_x, origY: row.pos_y }
    setSel({ kind, id })
  }
  function onPointerMove(e: PointerEvent): void {
    const d = drag.current
    if (!d) return
    const p = cellAt(e)
    moveTo(d.kind, d.id, d.origX + (p.x - d.startX), d.origY + (p.y - d.startY))
  }
  function onPointerUp(): void { drag.current = null }

  /** Teclado: flechas mueven 1 celda; Supr elimina. */
  function onItemKeyDown(e: KeyboardEvent<SVGGElement>, kind: PickKind, id: number): void {
    const row = kind === 'table' ? draftTables.find(t => t.id === id) : draftElements.find(el => el.id === id)
    if (!row) return
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const delta = step[e.key]
    if (delta) { e.preventDefault(); setSel({ kind, id }); moveTo(kind, id, row.pos_x + delta[0], row.pos_y + delta[1]) }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setSel({ kind, id }); setTimeout(removeSelected, 0) }
  }

  async function save(): Promise<void> {
    setSaving(true)
    const origTables = new Map(tables.map(t => [t.id, t]))
    const origElements = new Map(elements.map(e => [e.id, e]))
    const jobs: Array<Promise<{ ok: boolean; error?: string }>> = []

    for (const id of removed.tables) jobs.push(callApi(`/api/restaurante/mesas/${id}`, 'DELETE'))
    for (const id of removed.elements) jobs.push(callApi(`/api/restaurante/elementos/${id}`, 'DELETE'))
    for (const t of draftTables) {
      if (t.id < 0) {
        jobs.push(callApi('/api/restaurante/mesas', 'POST', {
          area_id: area.id, label: t.label, capacity: t.capacity, shape: t.shape,
          pos_x: t.pos_x, pos_y: t.pos_y, width: t.width, height: t.height, rotation: t.rotation,
        }))
        continue
      }
      const o = origTables.get(t.id)
      const patch = Object.fromEntries(TABLE_KEYS.filter(k => !o || o[k] !== t[k]).map(k => [k, t[k]]))
      if (Object.keys(patch).length > 0) jobs.push(callApi(`/api/restaurante/mesas/${t.id}`, 'PATCH', patch))
    }
    for (const el of draftElements) {
      if (el.id < 0) {
        jobs.push(callApi('/api/restaurante/elementos', 'POST', {
          area_id: area.id, kind: el.kind, label: el.label, pos_x: el.pos_x, pos_y: el.pos_y,
          width: el.width, height: el.height, rotation: el.rotation,
        }))
        continue
      }
      const o = origElements.get(el.id)
      const patch = Object.fromEntries(ELEMENT_KEYS.filter(k => !o || o[k] !== el[k]).map(k => [k, el[k]]))
      if (Object.keys(patch).length > 0) jobs.push(callApi(`/api/restaurante/elementos/${el.id}`, 'PATCH', patch))
    }

    const results = await Promise.all(jobs)
    const failed = results.find(r => !r.ok)
    if (failed && !failed.ok) {
      setSaving(false)
      toast(`No se guardó todo: ${failed.error ?? 'error'}. Corrige y vuelve a guardar.`, 'error')
      return
    }
    await onSaved()
    setSaving(false)
  }

  const tools: ReadonlyArray<{ label: string; icon: typeof Square; run: () => void }> = [
    { label: 'Mesa',            icon: Square,    run: () => addTable('rect') },
    { label: 'Mesa redonda',    icon: Circle,    run: () => addTable('round') },
    { label: 'Taburete',        icon: CircleDot, run: () => addTable('stool') },
    { label: 'Barra',           icon: Wine,      run: () => addElement('bar') },
    { label: 'Muro',            icon: Minus,     run: () => addElement('wall') },
    { label: 'Entrada',         icon: DoorOpen,  run: () => addElement('door') },
    { label: 'Pase de cocina',  icon: ChefHat,   run: () => addElement('pass') },
  ]

  return (
    <div className={styles.editor}>
      <p className={styles.mobileNote} role="note">
        Para acomodar el plano usa una pantalla más ancha (tablet o computador). Desde aquí solo puedes ver las mesas.
      </p>

      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.tools} role="toolbar" aria-label="Agregar al plano">
            {tools.map(t => (
              <button key={t.label} type="button" className={styles.tool} onClick={t.run}>
                <t.icon size={16} aria-hidden="true" />{t.label}
              </button>
            ))}
          </div>
          <div className={styles.planCard} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <PlanoSalon
              label={`Editor del plano de ${area.name}`} svgRef={svgRef} editable
              tables={draftTables} elements={draftElements} selected={sel}
              onPick={(kind, id) => setSel({ kind, id })}
              onItemPointerDown={onItemPointerDown} onItemKeyDown={onItemKeyDown}
            />
          </div>
          <p className={styles.tip}>Arrastra para mover; con el teclado, las flechas mueven una celda. Al soltar se ajusta a la cuadrícula. “Guardar plano” aplica todo junto.</p>
        </div>

        <aside className={styles.panel} aria-label="Propiedades">
          {selTable && (
            <div className={styles.card}>
              <div className={styles.cardHead}><b className={styles.cardTitle}>Mesa {selTable.label}</b><span className={styles.tip}>{area.name}</span></div>
              <label className={styles.field}><span>Etiqueta</span>
                <input className={styles.input} value={selTable.label} maxLength={20} onChange={e => updateTable(selTable.id, { label: e.target.value })} />
              </label>
              <div className={styles.field}><span id="rs-cap">Capacidad (define las sillas)</span>
                <div className={styles.stepper} role="group" aria-labelledby="rs-cap">
                  <button type="button" className={styles.stepBtn} aria-label="Menos personas" disabled={selTable.capacity <= 1} onClick={() => updateTable(selTable.id, { capacity: selTable.capacity - 1 })}><Minus size={16} aria-hidden="true" /></button>
                  <output className={styles.stepVal}>{selTable.capacity} {selTable.capacity === 1 ? 'persona' : 'personas'}</output>
                  <button type="button" className={styles.stepBtn} aria-label="Más personas" disabled={selTable.capacity >= 30} onClick={() => updateTable(selTable.id, { capacity: selTable.capacity + 1 })}><Plus size={16} aria-hidden="true" /></button>
                </div>
              </div>
              <div className={styles.field}><span id="rs-forma">Forma</span>
                <div className={styles.seg} role="radiogroup" aria-labelledby="rs-forma">
                  {SHAPES.map(s => (
                    <button
                      key={s.value} type="button" role="radio" aria-checked={selTable.shape === s.value}
                      className={`${styles.segBtn} ${selTable.shape === s.value ? styles.segOn : ''}`}
                      onClick={() => updateTable(selTable.id, s.value === 'stool'
                        ? { shape: s.value, width: 1, height: 1, capacity: 1 }
                        : { shape: s.value, ...(selTable.shape === 'stool' ? { width: 2, height: 2, capacity: 4 } : {}) })}
                    >{s.label}</button>
                  ))}
                </div>
              </div>
              <Dimensions row={selTable} onChange={p => updateTable(selTable.id, p)} />
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={removeSelected} disabled={selTable.account_id !== null}><Trash2 size={16} aria-hidden="true" />Eliminar mesa</button>
              <p className={styles.tip}>{selTable.account_id !== null ? 'Esta mesa tiene una cuenta abierta: no se puede eliminar hasta cerrarla.' : 'No se puede eliminar una mesa con cuenta abierta.'}</p>
            </div>
          )}
          {selElement && (
            <div className={styles.card}>
              <div className={styles.cardHead}><b className={styles.cardTitle}>{{ wall: 'Muro', door: 'Entrada', bar: 'Barra', pass: 'Pase de cocina' }[selElement.kind]}</b></div>
              {selElement.kind !== 'wall' && (
                <label className={styles.field}><span>Rótulo</span>
                  <input className={styles.input} value={selElement.label ?? ''} maxLength={40} placeholder="Texto del plano" onChange={e => updateElement(selElement.id, { label: e.target.value || null })} />
                </label>
              )}
              <Dimensions row={selElement} onChange={p => updateElement(selElement.id, p)} />
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={removeSelected}><Trash2 size={16} aria-hidden="true" />Eliminar</button>
            </div>
          )}
          {!sel && <div className={styles.card}><p className={styles.tip}>Selecciona una mesa o un elemento del plano para editar sus medidas.</p></div>}
        </aside>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.btn} onClick={onDiscard} disabled={saving}>Descartar</button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving || !dirty}>
          {saving ? 'Guardando…' : 'Guardar plano'}
        </button>
      </div>
    </div>
  )
}

interface DimRow { pos_x: number; pos_y: number; width: number; height: number; rotation: TableRotation }

/** Ancho, alto y rotación en celdas; la posición se muestra (se cambia arrastrando). */
function Dimensions({ row, onChange }: { row: DimRow; onChange: (p: Partial<DimRow>) => void }) {
  const num = (v: string): number => clamp(Number.parseInt(v, 10) || 1, 1, 20)
  return (
    <div className={styles.grid2}>
      <label className={styles.field}><span>Ancho</span>
        <input className={styles.input} type="number" inputMode="numeric" min={1} max={20} value={row.width} onChange={e => onChange({ width: num(e.target.value) })} />
      </label>
      <label className={styles.field}><span>Alto</span>
        <input className={styles.input} type="number" inputMode="numeric" min={1} max={20} value={row.height} onChange={e => onChange({ height: num(e.target.value) })} />
      </label>
      <label className={styles.field}><span>Rotación</span>
        <select className={styles.input} value={row.rotation} onChange={e => onChange({ rotation: Number(e.target.value) as TableRotation })}>
          {ROTATIONS.map(r => <option key={r} value={r}>{r}°</option>)}
        </select>
      </label>
      <div className={styles.field}><span>Posición</span><output className={styles.readout}>x{row.pos_x} · y{row.pos_y}</output></div>
    </div>
  )
}
