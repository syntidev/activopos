import type { CartaOpenState } from '@/types/carta'
import { clampFocus, readShowOn, type ShowOn } from '@/lib/slide-media'

/** Presets de la Carta: son tokens (--carta-*) en styles/tokens.css, elegidos por atributo data-carta-preset. */
export const CARTA_PRESETS = ['brasa', 'noche', 'cafe', 'mar', 'verde'] as const
export type CartaPreset = (typeof CARTA_PRESETS)[number]

/** Paleta cerrada de acentos (no hay color libre): cada una pasa contraste AA en cada preset (scripts/check-carta-contrast.mjs). */
export const CARTA_ACCENTS = ['rojo', 'vino', 'verde', 'azul', 'oro'] as const
export type CartaAccent = (typeof CARTA_ACCENTS)[number]

export const CARTA_STYLES = ['casual', 'fine'] as const
export type CartaStyle = (typeof CARTA_STYLES)[number]

export interface CartaSettings {
  preset: CartaPreset
  /** null = el acento por defecto del preset. */
  accent: CartaAccent | null
  style:  CartaStyle
}

function pick<T extends string>(list: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null
}

/** Lee settings.carta_preset / carta_accent / carta_style con valores por defecto (el guardado lo agrega el panel de CLI-A). */
export function readCartaSettings(settings: unknown): CartaSettings {
  const s = (settings ?? {}) as Record<string, unknown>
  const preset = pick(CARTA_PRESETS, s.carta_preset) ?? 'brasa'
  return {
    preset,
    accent: pick(CARTA_ACCENTS, s.carta_accent),
    style:  pick(CARTA_STYLES, s.carta_style) ?? (preset === 'noche' ? 'fine' : 'casual'),
  }
}

/* ── Horario: settings.carta_hours = { mon: [["11:00","22:00"]], ... } en hora de Caracas ── */

/** Claves de settings.carta_hours (contrato de la suite E2E): semana de lunes a domingo. */
export const DAY_KEYS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const
/** Orden de Date.getUTCDay(): 0 = domingo. */
const DAYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const
export const DAY_LABEL: Record<(typeof DAYS)[number], string> = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' }
type Span = [string, string]
export type CartaHours = Partial<Record<(typeof DAYS)[number], Span[]>>

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

export function readCartaHours(settings: unknown): CartaHours | null {
  const raw = ((settings ?? {}) as Record<string, unknown>).carta_hours
  if (!raw || typeof raw !== 'object') return null
  const out: CartaHours = {}
  for (const day of DAYS) {
    const spans = (raw as Record<string, unknown>)[day]
    if (!Array.isArray(spans)) continue
    out[day] = spans.filter((s): s is Span => Array.isArray(s) && s.length === 2 && TIME.test(String(s[0])) && TIME.test(String(s[1])))
  }
  return out
}

const toMin = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

function hourLabel(t: string): string {
  const h = Number(t.slice(0, 2))
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return h12 + ':' + t.slice(3) + ' ' + suffix
}

/** Caracas es UTC-4 todo el año (sin horario de verano). */
function caracasNow(now: Date): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() - 4 * 3600 * 1000)
  return { day: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
}

export function openState(hours: CartaHours | null, paused: boolean, now: Date = new Date()): CartaOpenState | null {
  if (paused) return { open: false, label: 'Pedidos en pausa' }
  if (!hours) return null
  const { day, minutes } = caracasNow(now)
  const today = hours[DAYS[day]] ?? []
  const current = today.find(([a, b]) => minutes >= toMin(a) && minutes < toMin(b))
  if (current) return { open: true, label: 'Abierto · cierra a las ' + hourLabel(current[1]) }
  const next = today.find(([a]) => toMin(a) > minutes)
  if (next) return { open: false, label: 'Cerrado · abre a las ' + hourLabel(next[0]) }
  for (let i = 1; i <= 7; i++) {
    const spans = hours[DAYS[(day + i) % 7]] ?? []
    if (spans.length > 0) return { open: false, label: 'Cerrado · abre ' + (i === 1 ? 'mañana' : 'pronto') + ' a las ' + hourLabel(spans[0][0]) }
  }
  return { open: false, label: 'Cerrado' }
}

/** Horario completo por día, para mostrarlo en la portada ("Lun 11:00 am – 10:00 pm", "Dom Cerrado"). */
export function formatHours(hours: CartaHours | null): { day: string; text: string }[] {
  if (!hours) return []
  return DAY_KEYS.map(d => ({
    day:  DAY_LABEL[d],
    text: (hours[d] ?? []).map(([a, b]) => hourLabel(a) + ' – ' + hourLabel(b)).join(', ') || 'Cerrado',
  }))
}

/* ── Portadas: settings.carta_cover_meta = { "1": { mobile_path, focus_x, focus_y, show_on }, "2": …, "3": … } ── */

export interface CartaCoverMeta { mobile_path: string | null; focus_x: number; focus_y: number; show_on: ShowOn }

/** Metadatos de las portadas 1..3 (índice 0..2); null = sin datos (enfoque centrado, sin imagen móvil, se muestra siempre). */
export function readCoverMeta(settings: unknown): (CartaCoverMeta | null)[] {
  const raw = ((settings ?? {}) as Record<string, unknown>).carta_cover_meta
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return ['1', '2', '3'].map(k => {
    const m = rec[k]
    if (!m || typeof m !== 'object') return null
    const o = m as Record<string, unknown>
    return { mobile_path: typeof o.mobile_path === 'string' && o.mobile_path ? o.mobile_path : null, focus_x: clampFocus(o.focus_x), focus_y: clampFocus(o.focus_y), show_on: readShowOn(o.show_on) }
  })
}

export function isCartaPaused(settings: unknown): boolean {
  return ((settings ?? {}) as Record<string, unknown>).carta_paused === true
}
