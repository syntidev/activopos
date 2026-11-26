'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useToast, ToastProvider } from '@/components/ui/Toast'
import { playBeep } from '@/lib/audio'
import { callApi } from '@/lib/restaurante-client'
import type { KdsBoardDTO, KdsItemDTO, KdsTicketDTO, StationDTO } from '@/types/restaurante'
import styles from './estacion.module.css'

/* ── Constantes ── */

const POLL_MS = 3_000
const TICK_MS = 1_000
const QUEUE_MAX = 20
const STALE_AFTER_S = 10
const BEEP_HZ = 880
const BEEP_MS = 180
const SOUND_KEY = 'rs-kds-sound'
const OFFLINE_PREFIX = 'Sin conexión'

type Column = 'nuevas' | 'prep' | 'atrasadas' | 'listas'
type Action = 'iniciar' | 'listo' | 'deshacer' | 'visto'
type Outcome = 'ok' | 'stale' | 'offline' | 'error'
interface QueuedAction { itemId: number; action: Action }

const COLUMN_LABEL: Record<Column, string> = { nuevas: 'Nuevas', prep: 'En preparación', atrasadas: 'Atrasadas', listas: 'Listas' }
const COLUMNS: readonly Column[] = ['nuevas', 'prep', 'atrasadas', 'listas']
type MobileTab = 'nuevas' | 'prep' | 'listas'
const MOBILE_TABS: ReadonlyArray<{ id: MobileTab; label: string }> = [{ id: 'nuevas', label: 'Nuevas' }, { id: 'prep', label: 'Prep.' }, { id: 'listas', label: 'Listas' }]
const EMPTY_TEXT: Record<Column, string> = { nuevas: 'Sin comandas nuevas', prep: 'Nada en preparación', atrasadas: '', listas: 'Nada listo todavía' }

/* ── Helpers puros ── */

const liveItems = (t: KdsTicketDTO): KdsItemDTO[] => t.items.filter(i => i.status !== 'void')

function elapsedMs(t: KdsTicketDTO, now: number): number { return Math.max(0, now - new Date(t.sent_at).getTime()) }

/** Comanda lista: el tiempo que tardó (envío → listo), fijo. Sin ready_at registrado, cae al reloj corrido. */
function shownMs(t: KdsTicketDTO, column: Column, now: number): number {
  if (column === 'listas' && t.ready_at) return Math.max(0, new Date(t.ready_at).getTime() - new Date(t.sent_at).getTime())
  return elapsedMs(t, now)
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function columnOf(t: KdsTicketDTO, station: StationDTO | undefined, now: number): Column {
  const items = liveItems(t)
  if (items.length > 0 && items.every(i => i.status === 'ready')) return 'listas'
  if (station && elapsedMs(t, now) >= station.critical_min * 60_000) return 'atrasadas'
  return items.some(i => i.status === 'preparing') ? 'prep' : 'nuevas'
}

const tabOf = (c: Column): MobileTab => (c === 'atrasadas' ? 'prep' : c)

function matches(t: KdsTicketDTO, q: string): boolean {
  if (q === '') return true
  return (t.table_label ?? '').toLowerCase().includes(q) || t.items.some(i => i.product_name.toLowerCase().includes(q))
}

const ticketKey = (t: KdsTicketDTO): string => `${t.order_id}:${t.station_id}`

/* ── Comanda ── */

interface TicketProps {
  ticket: KdsTicketDTO
  column: Column
  station: StationDTO | undefined
  now: number
  queued: boolean
  onAct: (item: KdsItemDTO, action: Action) => void
  onFire: (orderId: number, course: number) => void
}

function Ticket({ ticket, column, station, now, queued, onAct, onFire }: TicketProps) {
  const ms = shownMs(ticket, column, now)
  const warn = station !== undefined && column !== 'listas' && ms >= station.warn_min * 60_000
  const cls = [styles.tk, column === 'atrasadas' ? styles.late : warn ? styles.warn : '', column === 'listas' ? styles.done : ''].filter(Boolean).join(' ')
  const startable = ticket.items.find(i => i.status === 'sent' && !i.held)
  const preparing = ticket.items.find(i => i.status === 'preparing')
  const voided = ticket.items.find(i => i.status === 'void')
  const readyOne = ticket.items.find(i => i.status === 'ready')
  const heldCourses = Array.from(new Set(ticket.items.filter(i => i.held).map(i => i.course))).sort()
  const who = [ticket.waiter_name, `curso ${Math.min(...ticket.items.map(i => i.course))}`].filter(Boolean).join(' · ')

  return (
    <article className={cls} aria-label={`Comanda ${ticket.table_label ?? ticket.order_number}`}>
      <div className={styles.th}>
        <div>
          <div className={styles.mesa}>{ticket.table_label ?? ticket.order_number}</div>
          <div className={styles.who}>{who}{ticket.area_name ? ` · ${ticket.area_name}` : ''}</div>
        </div>
        {queued ? <span className={styles.queued}>EN COLA</span> : <div className={styles.tm}>{clock(ms)}</div>}
      </div>
      <ul className={styles.items}>
        {ticket.items.map(i => (
          <li key={i.id} className={[styles.item, i.held ? styles.hold : '', i.status === 'void' ? styles.voided : '', i.status === 'ready' && column !== 'listas' ? styles.itemReady : ''].filter(Boolean).join(' ')}>
            <b>{i.quantity}</b>
            <span>{i.product_name}</span>
            {i.modifiers.length > 0 && <em>{i.modifiers.map(m => m.option).join(' · ')}</em>}
            {i.note && <em>{i.note}</em>}
            {i.held && <em>espera curso {i.course - 1}</em>}
            {i.status === 'void' && <em>anulado{i.void_reason ? `: ${i.void_reason}` : ''}</em>}
            {i.status === 'ready' && column !== 'listas' && <em>listo</em>}
          </li>
        ))}
        {heldCourses.map(c => (
          <li key={`fire-${c}`} className={styles.item}>
            <button type="button" className={styles.fire} onClick={() => onFire(ticket.order_id, c)}>DISPARAR CURSO {c}</button>
          </li>
        ))}
      </ul>

      {column === 'listas' ? (
        <>
          <p className={styles.notified}>Avisado al mesonero</p>
          {readyOne && <div className={styles.actions}><button type="button" className={`${styles.bump} ${styles.bumpGhost}`} onClick={() => onAct(readyOne, 'deshacer')}>Deshacer</button></div>}
        </>
      ) : (
        <div className={styles.actions}>
          {startable && <button type="button" className={`${styles.bump} ${preparing ? '' : styles.bumpGhost}`} onClick={() => onAct(startable, 'iniciar')}>Empezar</button>}
          {preparing && <button type="button" className={styles.bump} onClick={() => onAct(preparing, 'listo')}>Listo</button>}
          {preparing && !startable && <button type="button" className={`${styles.bump} ${styles.bumpGhost} ${styles.bumpSide}`} onClick={() => onAct(preparing, 'deshacer')}>Deshacer</button>}
          {voided && <button type="button" className={`${styles.bump} ${styles.bumpGhost} ${styles.bumpSide}`} onClick={() => onAct(voided, 'visto')}>Visto</button>}
        </div>
      )}
    </article>
  )
}

/* ── Tablero ── */

interface Props { isAdmin: boolean }

function Board({ isAdmin }: Props) {
  const { toast } = useToast()
  const [stations, setStations] = useState<StationDTO[]>([])
  const [tickets, setTickets] = useState<KdsTicketDTO[]>([])
  const [sel, setSel] = useState<number | 'todas' | null>(null)
  const [tab, setTab] = useState<MobileTab>('nuevas')
  const [query, setQuery] = useState('')
  const [sound, setSound] = useState(false)
  const [online, setOnline] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [lastOk, setLastOk] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [queue, setQueue] = useState<QueuedAction[]>([])

  const cursor = useRef<string | null>(null)
  const known = useRef<Set<string> | null>(null)
  const soundRef = useRef(false)
  const queueRef = useRef<QueuedAction[]>([])
  const inFlight = useRef(false)

  useEffect(() => {
    try { if (window.localStorage.getItem(SOUND_KEY) === '1') { setSound(true); soundRef.current = true } } catch { /* sin almacenamiento: queda apagado */ }
  }, [])

  const setQueueBoth = (next: QueuedAction[]) => { queueRef.current = next; setQueue(next) }

  const sendAction = useCallback(async (q: QueuedAction): Promise<Outcome> => {
    const r = await callApi<{ ok: true }>(`/api/restaurante/kds/items/${q.itemId}`, 'PATCH', { action: q.action, scope: 'comanda' })
    if (r.ok) return 'ok'
    if (r.error.startsWith(OFFLINE_PREFIX)) return 'offline'
    if (r.error.includes('ya cambió')) return 'stale'
    toast(r.error, 'error')
    return 'error'
  }, [toast])

  const poll = useCallback(async (full: boolean) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      // Primero vacía la cola de lo hecho sin conexión, en orden; se detiene en el primer fallo de red.
      while (queueRef.current.length > 0) {
        const res = await sendAction(queueRef.current[0])
        if (res === 'offline') break
        setQueueBoth(queueRef.current.slice(1))
        if (res === 'stale') toast('Otra pantalla ya había cambiado esa comanda', 'info')
      }
      const since = !full && cursor.current ? `&since=${encodeURIComponent(cursor.current)}` : ''
      const r = await callApi<KdsBoardDTO>(`/api/restaurante/kds?station=todas${since}`, 'GET')
      if (!r.ok) {
        if (r.error.startsWith(OFFLINE_PREFIX)) setOnline(false)
        else toast(r.error, 'error')
        return
      }
      const b = r.data
      cursor.current = b.server_time
      setOnline(true); setLastOk(Date.now()); setLoaded(true); setStations(b.stations)
      setSel(cur => cur ?? (b.stations[0]?.id ?? 'todas'))
      setTickets(prev => {
        const changed = b.changed
        const next = changed === null ? b.tickets : [...prev.filter(t => !changed.includes(t.order_id)), ...b.tickets]
        const keys = new Set(next.map(ticketKey))
        const fresh = known.current !== null && next.some(t => !known.current?.has(ticketKey(t)) && t.items.some(i => i.status === 'sent'))
        if (fresh && soundRef.current) playBeep(BEEP_HZ, BEEP_MS)
        known.current = keys
        return next
      })
    } finally {
      inFlight.current = false
    }
  }, [sendAction, toast])

  // Sondeo cada 3 s (solo lo que cambió, por cursor); el reloj de las comandas corre cada segundo sin red.
  useEffect(() => {
    void poll(true)
    const p = window.setInterval(() => void poll(false), POLL_MS)
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => { window.clearInterval(p); window.clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el intervalo se arma una vez; poll solo lee refs y setters estables
  }, [])

  const toggleSound = () => {
    const next = !sound
    setSound(next); soundRef.current = next
    try { window.localStorage.setItem(SOUND_KEY, next ? '1' : '0') } catch { /* sin almacenamiento */ }
    if (next) playBeep(BEEP_HZ, BEEP_MS) // también desbloquea el audio del navegador
  }

  const act = useCallback(async (item: KdsItemDTO, action: Action) => {
    const q: QueuedAction = { itemId: item.id, action }
    const res = await sendAction(q)
    if (res === 'offline') {
      if (queueRef.current.length >= QUEUE_MAX) { toast('Cola llena: espera a recuperar la conexión', 'error'); return }
      setQueueBoth([...queueRef.current, q]); setOnline(false)
      return
    }
    if (res === 'stale') toast('Otra pantalla ya había cambiado esa comanda', 'info')
    void poll(false)
  }, [poll, sendAction, toast])

  const fire = useCallback(async (orderId: number, course: number) => {
    const r = await callApi<{ ok: true }>('/api/restaurante/kds/disparar', 'POST', { order_id: orderId, course })
    if (!r.ok) toast(r.error, 'error')
    void poll(false)
  }, [poll, toast])

  const stationById = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations])
  const q = query.trim().toLowerCase()
  const queuedItems = useMemo(() => new Set(queue.map(x => x.itemId)), [queue])
  const grouped = useMemo(() => {
    const g: Record<Column, KdsTicketDTO[]> = { nuevas: [], prep: [], atrasadas: [], listas: [] }
    for (const t of tickets) {
      if (typeof sel === 'number' && t.station_id !== sel) continue
      if (matches(t, q)) g[columnOf(t, stationById.get(t.station_id), now)].push(t)
    }
    return g
  }, [tickets, sel, q, stationById, now])

  const secsAgo = lastOk === null ? 0 : Math.max(0, Math.round((now - lastOk) / 1000))
  const stale = !online || secsAgo > STALE_AFTER_S
  const current = typeof sel === 'number' ? stationById.get(sel) : undefined
  const total = stations.reduce((n, s) => n + (s.open_tickets ?? 0), 0)

  if (loaded && stations.length === 0) {
    return (
      <section className={styles.root} aria-label="KDS">
        <div className={styles.empty}><b>Sin estaciones</b>{isAdmin ? 'Crea una en Configuración › Restaurante › Estaciones y ruteo.' : 'Pide a un administrador que te asigne una estación.'}</div>
      </section>
    )
  }

  return (
    <section className={styles.root} aria-label="KDS por estación">
      {!online && <div className={styles.offline} role="alert">SIN CONEXIÓN · reintentando{queue.length > 0 ? ` · ${queue.length} ${queue.length === 1 ? 'acción' : 'acciones'} en cola` : ''}</div>}
      <div className={styles.bar}>
        <h2 className={styles.title}>{current?.name ?? 'Cocina'}</h2>
        {stations.map(s => (
          <button key={s.id} type="button" className={`${styles.chip} ${sel === s.id ? styles.chipOn : ''}`} aria-pressed={sel === s.id} onClick={() => setSel(s.id)}>
            {s.name}<span className={styles.chipCount}>{s.open_tickets ?? 0}</span>
          </button>
        ))}
        {stations.length > 1 && (
          <button type="button" className={`${styles.chip} ${sel === 'todas' ? styles.chipOn : ''}`} aria-pressed={sel === 'todas'} onClick={() => setSel('todas')}>
            Todas<span className={styles.chipCount}>{total}</span>
          </button>
        )}
        <input className={styles.search} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Mesa o producto…" aria-label="Buscar mesa o producto" />
        <button type="button" className={`${styles.chip} ${styles.sound}`} aria-pressed={sound} onClick={toggleSound}>SONIDO {sound ? 'ON' : 'OFF'}</button>
        <span className={`${styles.live} ${stale ? styles.liveStale : ''}`} role="status">{stale ? '' : 'EN VIVO · '}hace {secsAgo} s</span>
        {isAdmin && <Link className={styles.chip} href="/kds?vista=pedidos">Pedidos normales</Link>}
      </div>

      <div className={styles.mobileTabs} role="tablist" aria-label="Estado de las comandas">
        {MOBILE_TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`${styles.chip} ${tab === t.id ? styles.chipOn : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className={styles.chipCount}>{t.id === 'prep' ? grouped.prep.length + grouped.atrasadas.length : grouped[t.id].length}</span>
          </button>
        ))}
      </div>

      <div className={styles.board}>
        {COLUMNS.map(c => (
          <div key={c} className={tabOf(c) === tab ? '' : styles.colHidden}>
            <div className={styles.colHead}>{COLUMN_LABEL[c]} · {grouped[c].length}</div>
            <div className={styles.col}>
              {grouped[c].length === 0 && c !== 'atrasadas' && <div className={styles.empty}><b>{EMPTY_TEXT[c]}</b></div>}
              {grouped[c].map(t => (
                <Ticket key={ticketKey(t)} ticket={t} column={c} station={stationById.get(t.station_id)} now={now}
                  queued={t.items.some(i => queuedItems.has(i.id))} onAct={(i, a) => void act(i, a)} onFire={(o, k) => void fire(o, k)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {current && <div className={styles.foot}><span>Umbrales {current.name}: ámbar {current.warn_min} min · rojo {current.critical_min} min</span></div>}
    </section>
  )
}

export function EstacionKds(props: Props) {
  return <ToastProvider><Board {...props} /></ToastProvider>
}
