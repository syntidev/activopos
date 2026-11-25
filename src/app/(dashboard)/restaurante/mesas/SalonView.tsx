'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PencilRuler, Search, Settings2 } from 'lucide-react'
import { useToast } from '@/components/ui'
import { callApi, reloadSalon } from '@/lib/restaurante-client'
import { matchesTableSearch, searchTokens, statusLabel } from '@/lib/restaurante'
import type { DiningTableDTO, SalonSnapshot, TableStatus } from '@/types/restaurante'
import { EditorPlano } from './EditorPlano'
import { MesaDetalle } from './MesaDetalle'
import { PlanoSalon, STATUS_TEXT } from './PlanoSalon'
import styles from './salon.module.css'

interface SalonViewProps {
  initial: SalonSnapshot
  isAdmin: boolean
}

const LEGEND: readonly TableStatus[] = ['libre', 'ocupada', 'por_cobrar', 'reservada', 'por_limpiar']

function byLabel(a: DiningTableDTO, b: DiningTableDTO): number {
  return a.label.localeCompare(b.label, 'es', { numeric: true })
}

/** Salón en vivo: zonas, búsqueda, plano (escritorio) o fichas (móvil) y cola "Para hacer ahora". */
export function SalonView({ initial, isAdmin }: SalonViewProps) {
  const { toast } = useToast()
  const [snap, setSnap] = useState<SalonSnapshot>(initial)
  const [areaId, setAreaId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const areas = useMemo(() => snap.areas.filter(a => a.active), [snap.areas])
  const area = areas.find(a => a.id === areaId) ?? areas[0] ?? null
  const tokens = useMemo(() => searchTokens(query), [query])

  const liveTables = useMemo(() => {
    const ids = new Set(areas.map(a => a.id))
    return snap.tables.filter(t => t.active && ids.has(t.area_id)).sort(byLabel)
  }, [snap.tables, areas])

  const areaTables = useMemo(() => liveTables.filter(t => t.area_id === area?.id), [liveTables, area])
  const areaElements = useMemo(() => snap.elements.filter(e => e.area_id === area?.id), [snap.elements, area])
  const visibleTables = tokens.length ? areaTables.filter(t => matchesTableSearch(t, tokens)) : areaTables
  const dimmed = useMemo(
    () => (tokens.length ? new Set(areaTables.filter(t => !matchesTableSearch(t, tokens)).map(t => t.id)) : undefined),
    [areaTables, tokens],
  )

  const count = (s: TableStatus): number => liveTables.filter(t => t.status === s).length
  const queue = useMemo(
    () => [
      ...liveTables.filter(t => t.status === 'reservada').sort((a, b) => (a.reserved_at ?? '').localeCompare(b.reserved_at ?? '')),
      ...liveTables.filter(t => t.status === 'por_limpiar'),
    ],
    [liveTables],
  )
  const detail = snap.tables.find(t => t.id === detailId) ?? null

  /* Atajo "/": enfoca la búsqueda sin interferir cuando se escribe en un campo. */
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const el = e.target as HTMLElement | null
      if (e.key !== '/' || el?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patchTable = useCallback(async (id: number, body: Record<string, unknown>): Promise<boolean> => {
    const res = await callApi<{ table: DiningTableDTO }>(`/api/restaurante/mesas/${id}`, 'PATCH', body)
    if (!res.ok) { toast(res.error, 'error'); return false }
    setSnap(s => ({ ...s, tables: s.tables.map(t => (t.id === id ? res.data.table : t)) }))
    toast(`Mesa ${res.data.table.label} actualizada`, 'success')
    return true
  }, [toast])

  const afterSave = useCallback(async (): Promise<void> => {
    const res = await reloadSalon()
    if (!res.ok) { toast(res.error, 'error'); return }
    setSnap(res.data)
    setDirty(false)
    setEditing(false)
    toast('Plano guardado', 'success')
  }, [toast])

  function areaCount(id: number, total: number): number {
    return tokens.length ? liveTables.filter(t => t.area_id === id && matchesTableSearch(t, tokens)).length : total
  }

  if (areas.length === 0) {
    return (
      <div className={styles.root}>
        <h1 className={styles.title}>Salón</h1>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aún no hay áreas ni mesas</p>
          <p className={styles.emptyText}>Crea tu primera área (Salón, Terraza, Barra…) y sus mesas en la configuración del módulo.</p>
          {isAdmin && <Link href="/configuracion?tab=restaurante" className={`${styles.btn} ${styles.btnPrimary}`}>Configurar áreas y mesas</Link>}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <h1 className={styles.title}>{editing ? 'Editar plano' : 'Salón'}</h1>
        <div className={styles.zones} role="tablist" aria-label="Áreas del salón">
          {areas.map(a => (
            <button
              key={a.id} type="button" role="tab" aria-selected={a.id === area?.id}
              className={`${styles.zone} ${a.id === area?.id ? styles.zoneOn : ''}`}
              disabled={editing && dirty && a.id !== area?.id}
              title={editing && dirty ? 'Guarda o descarta el plano antes de cambiar de área' : undefined}
              onClick={() => setAreaId(a.id)}
            >
              {a.name}<span className={styles.zoneCount}>{areaCount(a.id, a.table_count)}</span>
            </button>
          ))}
        </div>
        {!editing && (
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar mesa, cliente o cuenta" aria-label="Buscar mesa" maxLength={60} autoComplete="off"
            />
            <kbd className={styles.kbd} aria-hidden="true">/</kbd>
          </label>
        )}
        <div className={styles.actions}>
          {isAdmin && !editing && (
            <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
              <PencilRuler size={16} aria-hidden="true" />Editar plano
            </button>
          )}
          {isAdmin && (
            <Link href="/configuracion?tab=restaurante" className={styles.btn}><Settings2 size={16} aria-hidden="true" />Configurar</Link>
          )}
        </div>
      </header>

      {editing && area ? (
        <EditorPlano
          key={area.id} area={area}
          tables={snap.tables.filter(t => t.area_id === area.id)}
          elements={areaElements}
          onDirtyChange={setDirty}
          onDiscard={() => { setDirty(false); setEditing(false) }}
          onSaved={afterSave}
        />
      ) : (
        <>
          <ul className={styles.strip} aria-label="Resumen del salón">
            <li className={styles.stat}><b>{count('ocupada') + count('por_cobrar')}/{liveTables.length}</b>ocupadas</li>
            <li className={`${styles.stat} ${count('por_cobrar') > 0 ? styles.statWarn : ''}`}><b>{count('por_cobrar')}</b>por cobrar</li>
            <li className={styles.stat}><b>{count('reservada')}</b>reservadas</li>
            <li className={styles.stat}><b>{count('por_limpiar')}</b>por limpiar</li>
          </ul>

          <div className={styles.board}>
            <section className={styles.planCard} aria-label={`Plano de ${area?.name ?? 'salón'}`}>
              {areaTables.length === 0 && areaElements.length === 0 ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>{area?.name} no tiene mesas</p>
                  {isAdmin && <p className={styles.emptyText}>Créalas en lote desde Configurar y acomódalas con Editar plano.</p>}
                </div>
              ) : (
                <>
                  <div className={styles.planWide}>
                    <PlanoSalon
                      label={`Plano de ${area?.name ?? 'salón'}`} tables={areaTables} elements={areaElements} dimmed={dimmed}
                      onPick={(kind, id) => { if (kind === 'table') setDetailId(id) }}
                    />
                  </div>
                  <ul className={styles.tiles} aria-label={`Mesas de ${area?.name ?? 'salón'}`}>
                    {visibleTables.map(t => (
                      <li key={t.id}>
                        <button
                          type="button" className={`${styles.tile} ${styles[`tile_${t.status}`]}`} onClick={() => setDetailId(t.id)}
                          aria-label={`Mesa ${t.label}, ${t.capacity} ${t.capacity === 1 ? 'persona' : 'personas'}, ${STATUS_TEXT[t.status]}`}
                        >
                          <span className={styles.tileNum}>{t.label}</span>
                          <span className={styles.tileSub}>{statusLabel(t.status, t)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {tokens.length > 0 && visibleTables.length === 0 && <p className={styles.emptyText}>Ninguna mesa coincide con “{query.trim()}”.</p>}
                </>
              )}
              <ul className={styles.legend} aria-label="Leyenda de estados">
                {LEGEND.map(s => (
                  <li key={s}><i className={`${styles.sw} ${styles[`sw_${s}`]}`} aria-hidden="true" />{STATUS_TEXT[s].charAt(0).toUpperCase() + STATUS_TEXT[s].slice(1)}</li>
                ))}
              </ul>
            </section>

            <aside className={styles.queue} aria-labelledby="rs-cola">
              <h2 id="rs-cola" className={styles.qHead}>Para hacer ahora</h2>
              {queue.length === 0 && <p className={styles.emptyText}>Nada pendiente por ahora.</p>}
              {queue.map(t => (
                <div key={t.id} className={`${styles.act} ${styles[`act_${t.status}`]}`}>
                  <span className={styles.actTag}>{t.label}</span>
                  <div className={styles.actText}>
                    <p className={styles.actTitle}>{t.status === 'por_limpiar' ? 'Limpiar mesa' : `Reservada · ${t.reserved_for ?? ''}`}</p>
                    <p className={styles.actSub}>{t.area_name}{t.status === 'reservada' ? ` · ${statusLabel('reservada', t)}` : ''}</p>
                  </div>
                  {t.status === 'por_limpiar'
                    ? <button type="button" className={styles.actGo} onClick={() => patchTable(t.id, { cleaning_pending: false })}>Lista</button>
                    : <button type="button" className={styles.actGo} onClick={() => setDetailId(t.id)}>Ver</button>}
                </div>
              ))}
            </aside>
          </div>
        </>
      )}

      <MesaDetalle key={detail?.id ?? 'none'} table={detail} onClose={() => setDetailId(null)} onPatch={patchTable} />
    </div>
  )
}
