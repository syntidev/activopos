'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { confirmAction } from '@/context/ConfirmContext'
import { callApi } from '@/lib/restaurante-client'
import type { CatalogDTO, CatalogProductDTO, RoutingDTO, StationDTO } from '@/types/restaurante'
import styles from './config.module.css'

interface KitchenUser { id: number; name: string }
const DEFAULT_WARN = 10
const DEFAULT_CRITICAL = 20

/** Estación editable: guarda nombre y umbrales con el botón, y los cocineros al marcarlos. */
function StationCard({ station, kitchen, onChanged }: { station: StationDTO; kitchen: readonly KitchenUser[]; onChanged: () => Promise<void> }) {
  const { toast } = useToast()
  const [name, setName] = useState(station.name)
  const [warn, setWarn] = useState(String(station.warn_min))
  const [critical, setCritical] = useState(String(station.critical_min))
  const assignedIds = (station.users ?? []).map(u => u.id)
  const assigned = new Set(assignedIds)
  const dirty = name.trim() !== station.name || Number(warn) !== station.warn_min || Number(critical) !== station.critical_min

  async function patch(body: Record<string, unknown>, ok?: string): Promise<void> {
    const res = await callApi(`/api/restaurante/estaciones/${station.id}`, 'PATCH', body)
    if (!res.ok) { toast(res.error, 'error'); return }
    if (ok) toast(ok, 'success')
    await onChanged()
  }

  async function remove(): Promise<void> {
    const ok = await confirmAction({
      title: `Eliminar «${station.name}»`,
      message: 'Si tiene categorías, productos o comandas asignadas, solo se desactiva. Las comandas ya enviadas conservan su estación.',
      confirmLabel: 'Eliminar estación',
    })
    if (!ok) return
    const res = await callApi<{ deactivated: boolean }>(`/api/restaurante/estaciones/${station.id}`, 'DELETE')
    if (!res.ok) { toast(res.error, 'error'); return }
    toast(res.data.deactivated ? 'Estación desactivada' : 'Estación eliminada', 'success')
    await onChanged()
  }

  return (
    <li className={`${styles.card} ${station.active ? '' : styles.rowOff}`} aria-label={`Estación ${station.name}`}>
      <div className={styles.inline}>
        <label className={styles.field}><span>Nombre</span>
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} />
        </label>
        <label className={styles.field}><span>Ámbar (min)</span>
          <input className={styles.input} inputMode="numeric" value={warn} onChange={e => setWarn(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className={styles.field}><span>Rojo (min)</span>
          <input className={styles.input} inputMode="numeric" value={critical} onChange={e => setCritical(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!dirty || name.trim() === ''}
          onClick={() => { void patch({ name: name.trim(), warn_min: Number(warn), critical_min: Number(critical) }, 'Estación guardada') }}>Guardar</button>
      </div>
      <div className={styles.inline}>
        {station.is_default
          ? <span className={styles.badge}>Por defecto</span>
          : <button type="button" className={styles.btn} onClick={() => { void patch({ is_default: true }, 'Estación por defecto actualizada') }}>Marcar por defecto</button>}
        {!station.is_default && (
          <button type="button" className={styles.btn} onClick={() => { void patch({ active: !station.active }, station.active ? 'Estación desactivada' : 'Estación activada') }}>
            {station.active ? 'Desactivar' : 'Activar'}
          </button>
        )}
        {!station.is_default && (
          <button type="button" className={styles.iconBtn} aria-label={`Eliminar ${station.name}`} onClick={() => { void remove() }}><Trash2 size={18} aria-hidden="true" /></button>
        )}
      </div>
      <fieldset className={styles.plain}>
        <legend>Cocineros de esta estación</legend>
        {kitchen.length === 0 && <p className={styles.hint}>No hay usuarios con rol Cocinero. Créalos en Usuarios.</p>}
        {kitchen.map(u => (
          <label key={u.id} className={styles.checkRow}>
            <input type="checkbox" checked={assigned.has(u.id)}
              onChange={e => { void patch({ user_ids: e.target.checked ? [...assignedIds, u.id] : assignedIds.filter(id => id !== u.id) }) }} />
            <span>{u.name}</span>
          </label>
        ))}
      </fieldset>
    </li>
  )
}

/** Configuración › Restaurante › Estaciones y ruteo: dónde se prepara cada cosa y cuánto se tolera esperar. */
export function EstacionesRuteo() {
  const { toast } = useToast()
  const [stations, setStations] = useState<StationDTO[] | null>(null)
  const [routing, setRouting] = useState<RoutingDTO | null>(null)
  const [kitchen, setKitchen] = useState<KitchenUser[]>([])
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [warn, setWarn] = useState(String(DEFAULT_WARN))
  const [critical, setCritical] = useState(String(DEFAULT_CRITICAL))
  const [productQ, setProductQ] = useState('')
  const [found, setFound] = useState<CatalogProductDTO[]>([])
  const [productStation, setProductStation] = useState(0)

  const load = useCallback(async (): Promise<void> => {
    const [st, rt, us] = await Promise.all([
      callApi<{ stations: StationDTO[] }>('/api/restaurante/estaciones', 'GET'),
      callApi<{ routing: RoutingDTO }>('/api/restaurante/ruteo', 'GET'),
      callApi<{ users: Array<{ id: number; name: string; role: string; is_active: boolean }> }>('/api/users', 'GET'),
    ])
    if (st.ok) setStations(st.data.stations); else toast(st.error, 'error')
    if (rt.ok) setRouting(rt.data.routing); else toast(rt.error, 'error')
    if (us.ok) setKitchen(us.data.users.filter(u => u.role === 'kitchen' && u.is_active).map(u => ({ id: u.id, name: u.name })))
  }, [toast])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (productQ.trim().length < 2) { setFound([]); return }
    const handle = setTimeout(async () => {
      const res = await callApi<CatalogDTO>(`/api/restaurante/productos?q=${encodeURIComponent(productQ.trim())}`, 'GET')
      if (res.ok) setFound(res.data.products.slice(0, 6))
    }, 250)
    return () => clearTimeout(handle)
  }, [productQ])

  async function create(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (busy || name.trim() === '') return
    setBusy(true)
    const res = await callApi('/api/restaurante/estaciones', 'POST', { name: name.trim(), warn_min: Number(warn), critical_min: Number(critical) })
    setBusy(false)
    if (!res.ok) { toast(res.error, 'error'); return }
    toast(`«${name.trim()}» creada`, 'success')
    setName('')
    await load()
  }

  async function route(body: Record<string, unknown>): Promise<void> {
    const res = await callApi<{ routing: RoutingDTO }>('/api/restaurante/ruteo', 'PUT', body)
    if (!res.ok) { toast(res.error, 'error'); return }
    setRouting(res.data.routing)
  }

  const active = (stations ?? []).filter(s => s.active)
  const defaultName = active.find(s => s.is_default)?.name

  return (
    <div className={styles.root}>
      <header className={styles.head}><h2 className={styles.title}>Estaciones y ruteo</h2></header>
      <p className={styles.hint}>Cada ítem que se envía va a la estación de su producto; si no tiene, a la de su categoría; si tampoco, a la estación por defecto{defaultName ? ` (${defaultName})` : ''}. Cambiar el ruteo no mueve lo que ya está en cocina.</p>

      <form className={styles.card} onSubmit={create} aria-labelledby="rs-est-nueva">
        <h3 id="rs-est-nueva" className={styles.cardTitle}>Nueva estación</h3>
        <div className={styles.inline}>
          <label className={styles.field}><span>Nombre</span>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Barra" autoComplete="off" />
          </label>
          <label className={styles.field}><span>Ámbar (min)</span>
            <input className={styles.input} inputMode="numeric" value={warn} onChange={e => setWarn(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className={styles.field}><span>Rojo (min)</span>
            <input className={styles.input} inputMode="numeric" value={critical} onChange={e => setCritical(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || name.trim() === ''}>Crear estación</button>
        </div>
      </form>

      {stations !== null && stations.length === 0 && <p className={styles.hint}>Todavía no hay estaciones. La primera que crees queda como estación por defecto.</p>}
      <ul className={styles.stack}>
        {(stations ?? []).map(s => <StationCard key={`${s.id}:${s.name}:${s.warn_min}:${s.critical_min}:${(s.users ?? []).length}`} station={s} kitchen={kitchen} onChanged={load} />)}
      </ul>

      {routing !== null && (
        <section className={styles.card} aria-labelledby="rs-ruteo">
          <h3 id="rs-ruteo" className={styles.cardTitle}>Ruteo por categoría</h3>
          <ul className={styles.list}>
            {routing.categories.map(c => (
              <li key={c.id} className={styles.row}>
                <span className={styles.rowMain}>{c.name}</span>
                <select className={styles.input} aria-label={`Estación de ${c.name}`} value={c.station_id ?? 0}
                  onChange={e => { void route({ category_id: c.id, station_id: Number(e.target.value) || null }) }}>
                  <option value={0}>{c.requires_preparation ? `Por defecto${defaultName ? ` (${defaultName})` : ''}` : 'No pasa por cocina'}</option>
                  {active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={c.requires_preparation} onChange={e => { void route({ category_id: c.id, station_id: c.station_id, requires_preparation: e.target.checked }) }} />
                  <span>Requiere preparación</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {routing !== null && (
        <section className={styles.card} aria-labelledby="rs-ruteo-prod">
          <h3 id="rs-ruteo-prod" className={styles.cardTitle}>Excepciones por producto</h3>
          <p className={styles.hint}>Un producto con estación propia ignora la de su categoría.</p>
          <ul className={styles.list}>
            {routing.overrides.map(p => (
              <li key={p.id} className={styles.row}>
                <span className={styles.rowMain}>{p.name}</span>
                <span className={styles.rowDetail}>{active.find(s => s.id === p.station_id)?.name ?? 'Estación inactiva'}</span>
                <button type="button" className={styles.btn} onClick={() => { void route({ product_id: p.id, station_id: null }) }}>Quitar</button>
              </li>
            ))}
          </ul>
          <div className={styles.inline}>
            <label className={styles.search}><Search size={16} aria-hidden="true" />
              <input type="search" value={productQ} onChange={e => setProductQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" maxLength={60} autoComplete="off" />
            </label>
            <select className={styles.input} aria-label="Estación del producto" value={productStation} onChange={e => setProductStation(Number(e.target.value))}>
              <option value={0}>Elige una estación</option>
              {active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className={styles.picks}>
            {found.map(p => (
              <button key={p.id} type="button" className={styles.pick} disabled={productStation === 0}
                onClick={() => { void route({ product_id: p.id, station_id: productStation }).then(() => { setProductQ(''); setFound([]) }) }}>
                <span>{p.name}</span><span>{p.category_name ?? ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
