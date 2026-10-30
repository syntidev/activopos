import {
  PULSO_MAX_BATCH,
  type PulsoAttribution,
  type PulsoBatchBody,
  type PulsoEventInput,
  type PulsoOrderContext,
} from '@/types/pulso'
import { mergeAttribution, nextSession } from '@/lib/pulso-attribution'

const SESSION_KEY = 'activopos_pulso_session'
const ATTR_KEY = 'activopos_pulso_attr'
const ENDPOINT = '/api/public/events'
const FLUSH_DELAY_MS = 3000

/** `path` es opcional: por defecto la ruta actual sin query. */
export type PulsoTrackInput = Omit<PulsoEventInput, 'path'> & { path?: string }

let slug: string | null = null
let sessionId: string | null = null
let attribution: PulsoAttribution | null = null
let queue: PulsoEventInput[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function isDnt(): boolean {
  try {
    const w = window as Window & { doNotTrack?: string }
    return navigator.doNotTrack === '1' || w.doNotTrack === '1'
  } catch {
    return false
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null // storage bloqueado o JSON corrupto: se trata como ausente
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage bloqueado: la sesión vive solo en memoria
  }
}

function isStoredSession(v: { id?: unknown; lastSeen?: unknown } | null): v is { id: string; lastSeen: number } {
  return Boolean(v) && typeof v?.id === 'string' && typeof v?.lastSeen === 'number'
}

function touchSession(): void {
  const stored = readJson<{ id?: unknown; lastSeen?: unknown }>(SESSION_KEY)
  const s = nextSession(isStoredSession(stored) ? stored : null, Date.now(), () => crypto.randomUUID())
  sessionId = s.id
  writeJson(SESSION_KEY, { id: s.id, lastSeen: s.lastSeen })
  if (s.renewed) { attribution = null; writeJson(ATTR_KEY, {}) }
}

/** Mezcla la atribución entrante (UTM/referrer) con la de la sesión y la persiste. */
export function setPulsoAttribution(incoming: PulsoAttribution): void {
  try {
    if (!slug || isDnt()) return
    const current = attribution ?? readJson<PulsoAttribution>(ATTR_KEY)
    // La renovación ya limpió la atribución en touchSession: aquí la sesión está vigente.
    attribution = mergeAttribution(current, incoming, false)
    writeJson(ATTR_KEY, attribution)
  } catch {
    // analítica nunca debe romper el catálogo
  }
}

function send(body: string): void {
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
  } catch {
    // cae al fetch
  }
  fetch(ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body })
    .catch(() => { /* sin red: se descarta, no se reintenta */ })
}

function flush(): void {
  if (timer) { clearTimeout(timer); timer = null }
  try {
    while (queue.length > 0 && slug && sessionId) {
      const events = queue.splice(0, PULSO_MAX_BATCH)
      const body: PulsoBatchBody = { slug, session_id: sessionId, events }
      if (attribution && Object.keys(attribution).length > 0) body.attribution = attribution
      send(JSON.stringify(body))
    }
    queue = []
  } catch {
    queue = []
  }
}

function onHide(): void {
  if (document.visibilityState === 'hidden') flush()
}

/** Idempotente: inicia (o retoma) la sesión del catálogo `slug`. */
export function initPulso(newSlug: string): void {
  try {
    if (typeof window === 'undefined' || isDnt()) return
    slug = newSlug
    touchSession()
    attribution = attribution ?? readJson<PulsoAttribution>(ATTR_KEY)
    if (!listening) {
      listening = true
      document.addEventListener('visibilitychange', onHide)
      window.addEventListener('pagehide', flush)
    }
  } catch {
    // analítica nunca debe romper el catálogo
  }
}

export function track(event: PulsoTrackInput): void {
  try {
    if (!slug || isDnt()) return
    touchSession()
    queue.push({ ...event, path: event.path ?? window.location.pathname })
    if (queue.length >= PULSO_MAX_BATCH) flush()
    else if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS)
  } catch {
    // analítica nunca debe romper el catálogo
  }
}

export function getPulsoOrderContext(): PulsoOrderContext | null {
  try {
    if (!slug || !sessionId || isDnt()) return null
    return { session_id: sessionId, ...(attribution ?? {}) }
  } catch {
    return null
  }
}
