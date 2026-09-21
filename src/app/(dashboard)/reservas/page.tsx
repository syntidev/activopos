'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import type { DemandaResponse, ReservaColumn, ReservaDTO } from '@/types/reservas'
import { DemandaPanel } from './DemandaPanel'
import { ReservaCard } from './ReservaCard'
import { FotoModal, PagoModal, UndoModal } from './ReservaModals'
import { columnOf, matchesSearch } from './format'
import styles from './reservas.module.css'

/* ── Types ── */

interface CollectionOption {
  id: number
  slug: string
  name: string
}

/** Cuerpo del PATCH: cada bandera viaja sola (ver /api/reservas/[id]). */
interface PatchBody {
  armado?: boolean
  entregado?: boolean
  entregado_foto?: string
  pagado?: boolean
  pagado_monto?: number
  pagado_metodo?: string
}

/* ── Constants ── */

const DEFAULT_COLLECTION_SLUG = '200k-2027'

const COLUMNS: { key: ReservaColumn; label: string; dot: string }[] = [
  { key: 'pendiente', label: 'Pendiente de armar',          dot: styles.colPendiente },
  { key: 'armado',    label: 'Armado / Listo para entrega', dot: styles.colArmado },
  { key: 'entregado', label: 'Entregado',                   dot: styles.colEntregado },
]

/* Solo Pagado pide confirmación al desmarcar (borra monto y método). Entregado y
   Armado se alternan directo: no destruyen datos, y la foto es independiente. */
const UNDO_PAGO_COPY = {
  title: 'Desmarcar Pagado',
  message: 'Se borrarán el monto y el método de pago registrados.',
  confirm: 'Desmarcar pago',
}

/* ── Page ── */

function ReservasContent() {
  const { toast } = useToast()

  const [collections, setCollections] = useState<CollectionOption[]>([])
  const [collectionsReady, setCollectionsReady] = useState(false)
  const [slug, setSlug] = useState('')
  const [reservas, setReservas] = useState<ReservaDTO[]>([])
  const [demanda, setDemanda] = useState<DemandaResponse | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busyIds, setBusyIds] = useState<number[]>([])

  const [fotoTarget, setFotoTarget] = useState<ReservaDTO | null>(null)
  const [pagoTarget, setPagoTarget] = useState<ReservaDTO | null>(null)
  const [undoPagoTarget, setUndoPagoTarget] = useState<ReservaDTO | null>(null)

  /* Colecciones: se elige 200k-2027 si existe; si no, la primera; si no hay, todas. */
  useEffect(() => {
    let cancelled = false
    fetch('/api/collections')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { collections?: CollectionOption[] } | null) => {
        if (cancelled) return
        const list = data?.collections ?? []
        setCollections(list)
        const preferred = list.find(c => c.slug === DEFAULT_COLLECTION_SLUG) ?? list[0]
        setSlug(preferred?.slug ?? '')
      })
      .catch(() => { if (!cancelled) setSlug('') })
      .finally(() => { if (!cancelled) setCollectionsReady(true) })
    return () => { cancelled = true }
  }, [])

  const loadBoard = useCallback(async (collection: string) => {
    setLoading(true)
    setLoadError(null)
    const qs = collection ? `?collection=${encodeURIComponent(collection)}` : ''
    try {
      const [reservasRes, demandaRes, rateRes] = await Promise.all([
        fetch(`/api/reservas${qs}`),
        fetch(`/api/reservas/demanda${qs}`),
        fetch('/api/rates/bcv').catch(() => null),
      ])
      if (!reservasRes.ok) {
        const body: { error?: string } = await reservasRes.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudieron cargar las reservas')
      }
      const list: { reservas: ReservaDTO[] } = await reservasRes.json()
      setReservas(list.reservas)
      setDemanda(demandaRes.ok ? ((await demandaRes.json()) as DemandaResponse) : null)
      if (rateRes?.ok) {
        const json: { rate?: number | string } | null = await rateRes.json().catch(() => null)
        if (json?.rate) setRate(Number(json.rate))
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (collectionsReady) void loadBoard(slug)
  }, [collectionsReady, slug, loadBoard])

  /* PATCH puntual de UNA bandera: nunca toca las otras dos. */
  const patchReserva = useCallback(async (id: number, body: PatchBody): Promise<ReservaDTO> => {
    setBusyIds(prev => [...prev, id])
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: { reserva?: ReservaDTO; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.reserva) throw new Error(data.error ?? 'No se pudo actualizar la reserva')
      const updated = data.reserva
      setReservas(prev => prev.map(r => (r.id === id ? updated : r)))
      return updated
    } finally {
      setBusyIds(prev => prev.filter(x => x !== id))
    }
  }, [])

  /* Armado y Entregado se alternan directo (un PATCH puntual, sin modal ni condiciones). */
  const toggleFlag = async (r: ReservaDTO, body: PatchBody) => {
    try {
      await patchReserva(r.id, body)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error de conexión', 'error')
    }
  }

  const toggleArmado = (r: ReservaDTO) => toggleFlag(r, { armado: !r.armado })
  const toggleEntregado = (r: ReservaDTO) => toggleFlag(r, { entregado: !r.entregado })

  const togglePagado = (r: ReservaDTO) => {
    if (r.pagado) setUndoPagoTarget(r)
    else setPagoTarget(r)
  }

  /* Foto opcional: botón aparte, antes, durante o después de marcar Entregado (o nunca). */
  const confirmFoto = async (fotoUrl: string) => {
    if (!fotoTarget) return
    const updated = await patchReserva(fotoTarget.id, { entregado_foto: fotoUrl })
    setFotoTarget(null)
    toast(`Foto guardada en ${updated.ticket_number}`, 'success')
  }

  const confirmPago = async (monto: number, metodo: string) => {
    if (!pagoTarget) return
    const updated = await patchReserva(pagoTarget.id, { pagado: true, pagado_monto: monto, pagado_metodo: metodo })
    setPagoTarget(null)
    toast(`Pago de ${updated.ticket_number} registrado`, 'success')
  }

  const confirmUndoPago = async () => {
    if (!undoPagoTarget) return
    const updated = await patchReserva(undoPagoTarget.id, { pagado: false })
    setUndoPagoTarget(null)
    toast(`${updated.ticket_number}: pago desmarcado`, 'info')
  }

  /* Búsqueda híbrida (ticket + cliente + teléfono): filtra en el momento sobre lo cargado. */
  const visible = useMemo(
    () => (query.trim() ? reservas.filter(r => matchesSearch(r, query)) : reservas),
    [reservas, query],
  )

  const byColumn = useMemo(() => {
    const groups: Record<ReservaColumn, ReservaDTO[]> = { pendiente: [], armado: [], entregado: [] }
    for (const r of visible) groups[columnOf(r)].push(r)
    return groups
  }, [visible])

  const collectionName = collections.find(c => c.slug === slug)?.name

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reservas{collectionName ? ` · ${collectionName}` : ''}</h1>
          <p className={styles.pageSubtitle}>
            Logística de la preventa. Cada tarjeta tiene 3 banderas independientes: armado, entregado y pagado.
          </p>
        </div>
        <div className={styles.headerActions}>
          {collections.length > 1 ? (
            <select
              className={styles.select}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-label="Colección"
            >
              {collections.map(c => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          ) : null}
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar ticket, nombre o teléfono"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar por ticket, nombre de cliente o teléfono"
            />
            {query ? (
              <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {loading ? (
        <div className={styles.stateBox} role="status">Cargando reservas…</div>
      ) : loadError ? (
        <div className={styles.stateBox} role="alert">
          <p>{loadError}</p>
          <Button variant="secondary" onClick={() => void loadBoard(slug)}>Reintentar</Button>
        </div>
      ) : reservas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aún no hay reservas"
          description="Cuando se registren reservas para esta colección, aparecerán aquí en el tablero."
        />
      ) : (
        <>
          <DemandaPanel demanda={demanda} />
          <ErrorBoundary>
            <div className={styles.kanban} role="region" aria-label="Tablero de logística de reservas">
              {COLUMNS.map(({ key, label, dot }) => (
                <section key={key} className={styles.column} aria-label={label}>
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitleRow}>
                      <span className={`${styles.columnDot} ${dot}`} aria-hidden="true" />
                      <span className={styles.columnLabel}>{label}</span>
                    </div>
                    <span className={styles.columnCount}>{byColumn[key].length}</span>
                  </div>
                  {byColumn[key].length === 0 ? (
                    <p className={styles.columnEmpty}>{query ? 'Sin coincidencias' : 'Sin reservas'}</p>
                  ) : (
                    byColumn[key].map(r => (
                      <ReservaCard
                        key={r.id}
                        reserva={r}
                        rate={rate}
                        busy={busyIds.includes(r.id)}
                        onToggleArmado={toggleArmado}
                        onToggleEntregado={toggleEntregado}
                        onTogglePagado={togglePagado}
                        onAddFoto={setFotoTarget}
                      />
                    ))
                  )}
                </section>
              ))}
            </div>
          </ErrorBoundary>
        </>
      )}

      <FotoModal reserva={fotoTarget} onClose={() => setFotoTarget(null)} onConfirm={confirmFoto} />
      <PagoModal reserva={pagoTarget} rate={rate} onClose={() => setPagoTarget(null)} onConfirm={confirmPago} />
      <UndoModal
        open={undoPagoTarget !== null}
        title={UNDO_PAGO_COPY.title}
        message={undoPagoTarget ? `${undoPagoTarget.ticket_number}: ${UNDO_PAGO_COPY.message}` : ''}
        confirmLabel={UNDO_PAGO_COPY.confirm}
        onClose={() => setUndoPagoTarget(null)}
        onConfirm={confirmUndoPago}
      />
    </div>
  )
}

export default function ReservasPage() {
  return (
    <ToastProvider>
      <ReservasContent />
    </ToastProvider>
  )
}
