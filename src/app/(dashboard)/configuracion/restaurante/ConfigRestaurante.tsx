'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { PencilRuler, Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { confirmAction } from '@/context/ConfirmContext'
import { callApi, reloadSalon, type ApiResult } from '@/lib/restaurante-client'
import { matchesTableSearch, searchTokens } from '@/lib/restaurante'
import type { DiningTableDTO, SalonSnapshot, TableShape } from '@/types/restaurante'
import styles from './config.module.css'

const SHAPE_LABEL: Record<TableShape, string> = { rect: 'Cuadrada', round: 'Redonda', stool: 'Taburete' }
const BATCH_MAX = 100

function byLabel(a: DiningTableDTO, b: DiningTableDTO): number {
  return a.label.localeCompare(b.label, 'es', { numeric: true })
}

/** Switch accesible de 44px: role="switch" + aria-checked. */
function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={styles.switchHit} onClick={() => onChange(!on)}>
      <span className={`${styles.switch} ${on ? styles.switchOn : ''}`} aria-hidden="true" />
    </button>
  )
}

/** Configuración del módulo Restaurante: áreas, mesas en lote y mesas existentes (solo admin). */
export function ConfigRestaurante({ initial }: { initial: SalonSnapshot }) {
  const { toast } = useToast()
  const [snap, setSnap] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [newArea, setNewArea] = useState('')
  const [batch, setBatch] = useState({ area_id: initial.areas[0]?.id ?? 0, from: '', to: '', capacity: '4', shape: 'rect' as TableShape })
  const [filterArea, setFilterArea] = useState<number>(0)
  const [query, setQuery] = useState('')

  const tokens = useMemo(() => searchTokens(query), [query])
  const tables = useMemo(
    () => snap.tables.filter(t => (filterArea === 0 || t.area_id === filterArea) && matchesTableSearch(t, tokens)).sort(byLabel),
    [snap.tables, filterArea, tokens],
  )

  const from = Number.parseInt(batch.from, 10)
  const to = Number.parseInt(batch.to, 10)
  const batchCount = Number.isInteger(from) && Number.isInteger(to) && to >= from ? to - from + 1 : 0
  // El área elegida; mientras no se elija ninguna, la primera (también la recién creada).
  const batchArea = snap.areas.some(a => a.id === batch.area_id) ? batch.area_id : (snap.areas[0]?.id ?? 0)
  const batchValid = batchArea > 0 && batchCount > 0 && batchCount <= BATCH_MAX

  /** Ejecuta una llamada, avisa y vuelve a leer el salón. */
  async function run(call: () => Promise<ApiResult<unknown>>, success: string): Promise<boolean> {
    setBusy(true)
    const res = await call()
    if (!res.ok) { toast(res.error, 'error'); setBusy(false); return false }
    const fresh = await reloadSalon()
    if (fresh.ok) setSnap(fresh.data)
    toast(success, 'success')
    setBusy(false)
    return true
  }

  async function createArea(e: FormEvent): Promise<void> {
    e.preventDefault()
    const name = newArea.trim()
    if (!name) return
    if (await run(() => callApi('/api/restaurante/areas', 'POST', { name }), `Área “${name}” creada`)) setNewArea('')
  }

  async function createBatch(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!batchValid) return
    const body = { area_id: batchArea, from, to, capacity: Number.parseInt(batch.capacity, 10) || 4, shape: batch.shape }
    if (await run(() => callApi('/api/restaurante/mesas', 'POST', body), `${batchCount} ${batchCount === 1 ? 'mesa creada' : 'mesas creadas'}`)) {
      setBatch(b => ({ ...b, from: '', to: '' }))
    }
  }

  async function removeTable(t: DiningTableDTO): Promise<void> {
    const ok = await confirmAction({
      title: `Eliminar mesa ${t.label}`,
      message: `Se elimina la mesa ${t.label} de ${t.area_name} y su lugar en el plano. Si solo quieres dejar de usarla, desactívala.`,
      confirmLabel: 'Eliminar mesa',
    })
    if (ok) await run(() => callApi(`/api/restaurante/mesas/${t.id}`, 'DELETE'), `Mesa ${t.label} eliminada`)
  }

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <h1 className={styles.title}>Configuración · Restaurante</h1>
        <span className={styles.lock}>Módulo activo para este negocio</span>
        <Link href="/restaurante/mesas" className={styles.btn}><PencilRuler size={16} aria-hidden="true" />Abrir editor de plano</Link>
      </header>

      <div className={styles.cols}>
        <section className={styles.card} aria-labelledby="rs-areas">
          <h2 id="rs-areas" className={styles.cardTitle}>Áreas</h2>
          {snap.areas.length === 0 ? (
            <p className={styles.hint}>Todavía no tienes áreas. Crea la primera: Salón, Terraza, Barra…</p>
          ) : (
            <ul className={styles.list}>
              {snap.areas.map(a => (
                <li key={a.id} className={styles.row}>
                  <b className={styles.rowMain}>{a.name}</b>
                  <span className={styles.mono}>{a.table_count} {a.table_count === 1 ? 'mesa' : 'mesas'}</span>
                  <Switch on={a.active} disabled={busy} label={`Área ${a.name} activa`}
                    onChange={next => void run(() => callApi(`/api/restaurante/areas/${a.id}`, 'PATCH', { active: next }), next ? `${a.name} activada` : `${a.name} desactivada`)} />
                </li>
              ))}
            </ul>
          )}
          <form className={styles.inline} onSubmit={createArea}>
            <label className={styles.field}><span>Nueva área</span>
              <input className={styles.input} value={newArea} onChange={e => setNewArea(e.target.value)} maxLength={60} placeholder="Terraza" autoComplete="off" />
            </label>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || newArea.trim().length === 0}>Crear área</button>
          </form>
        </section>

        <form className={styles.card} onSubmit={createBatch} aria-labelledby="rs-lote">
          <h2 id="rs-lote" className={styles.cardTitle}>Crear mesas en lote</h2>
          {snap.areas.length === 0 ? (
            <p className={styles.hint}>Primero crea un área.</p>
          ) : (
            <>
              <div className={styles.grid3}>
                <label className={styles.field}><span>Área</span>
                  <select className={styles.input} value={batchArea} onChange={e => setBatch(b => ({ ...b, area_id: Number(e.target.value) }))}>
                    {snap.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className={styles.field}><span>Del número</span>
                  <input className={styles.input} inputMode="numeric" value={batch.from} onChange={e => setBatch(b => ({ ...b, from: e.target.value.replace(/\D/g, '') }))} placeholder="1" />
                </label>
                <label className={styles.field}><span>Al número</span>
                  <input className={styles.input} inputMode="numeric" value={batch.to} onChange={e => setBatch(b => ({ ...b, to: e.target.value.replace(/\D/g, '') }))} placeholder="4" />
                </label>
                <label className={styles.field}><span>Capacidad</span>
                  <input className={styles.input} inputMode="numeric" value={batch.capacity} onChange={e => setBatch(b => ({ ...b, capacity: e.target.value.replace(/\D/g, '') }))} />
                </label>
                <label className={styles.field}><span>Forma</span>
                  <select className={styles.input} value={batch.shape} onChange={e => setBatch(b => ({ ...b, shape: e.target.value as TableShape }))}>
                    {(Object.keys(SHAPE_LABEL) as TableShape[]).map(s => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}
                  </select>
                </label>
              </div>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !batchValid}>
                {batchCount > 0 ? `Crear ${batchCount} ${batchCount === 1 ? 'mesa' : 'mesas'}` : 'Crear mesas'}
              </button>
              <p className={styles.hint}>Las mesas nuevas entran en un hueco libre del plano; luego las acomodas arrastrando en el editor. La capacidad define cuántas sillas se dibujan.</p>
            </>
          )}
        </form>
      </div>

      <section className={styles.card} aria-labelledby="rs-mesas">
        <div className={styles.sec}>
          <h2 id="rs-mesas" className={styles.cardTitle}>Mesas</h2>
          <select className={`${styles.input} ${styles.areaSel}`} value={filterArea} onChange={e => setFilterArea(Number(e.target.value))} aria-label="Filtrar por área">
            <option value={0}>Todas las áreas</option>
            {snap.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar mesa" aria-label="Buscar mesa" maxLength={60} autoComplete="off" />
          </label>
        </div>
        {tables.length === 0 ? (
          <p className={styles.hint}>{snap.tables.length === 0 ? 'Aún no hay mesas. Créalas en lote arriba.' : 'Ninguna mesa coincide con la búsqueda.'}</p>
        ) : (
          <ul className={styles.list}>
            {tables.map(t => (
              <li key={t.id} className={`${styles.row} ${styles.rowTable} ${t.active ? '' : styles.rowOff}`}>
                <b className={`${styles.rowMain} ${styles.mono}`}>{t.label}</b>
                <span className={styles.rowDetail}>
                  {t.area_name} · {t.capacity} {t.capacity === 1 ? 'persona' : 'personas'} · {SHAPE_LABEL[t.shape]} · <span className={styles.mono}>x{t.pos_x} y{t.pos_y}</span>
                </span>
                <Switch on={t.active} disabled={busy} label={`Mesa ${t.label} de ${t.area_name} activa`}
                  onChange={next => void run(() => callApi(`/api/restaurante/mesas/${t.id}`, 'PATCH', { active: next }), `Mesa ${t.label} ${next ? 'activada' : 'desactivada'}`)} />
                <button type="button" className={styles.iconBtn} disabled={busy} aria-label={`Eliminar mesa ${t.label} de ${t.area_name}`} onClick={() => void removeTable(t)}>
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
