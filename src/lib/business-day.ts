// Día de negocio: las fechas se guardan en UTC pero el negocio opera en
// America/Caracas (UTC-4, sin horario de verano). Toda ruta/pantalla que
// calcule "hoy", "7 días" o "este mes" pasa por aquí. Sin dependencias: sirve
// en servidor y cliente, y se puede cargar directo desde scripts/*.mjs.

export const BUSINESS_TZ = 'America/Caracas'

const MS_DAY = 86_400_000
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Desfase de la zona del negocio respecto a UTC en el instante dado, en ms (Caracas: -14_400_000). */
function offsetMs(at: Date): number {
  const p: Record<string, number> = {}
  for (const part of partsFormatter.formatToParts(at)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** Desfase en horas enteras (Caracas: -4). Para expresiones SQL sobre columnas UTC. */
export function businessOffsetHours(at: Date = new Date()): number {
  return Math.round(offsetMs(at) / 3_600_000)
}

/** 'YYYY-MM-DD' del día de negocio al que pertenece el instante. */
export function businessDateKey(at: Date = new Date()): string {
  return keyFormatter.format(at)
}

/** Instante UTC en que empieza (00:00 hora del negocio) el día `key`. */
export function businessDayStart(key: string): Date {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`Fecha inválida: ${key}`)
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const guess = new Date(naive - offsetMs(new Date(naive)))
  return new Date(naive - offsetMs(guess))
}

/** Suma `days` (puede ser negativo) a una clave 'YYYY-MM-DD'. */
export function shiftDateKey(key: string, days: number): string {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`Fecha inválida: ${key}`)
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * MS_DAY
  return new Date(t).toISOString().slice(0, 10)
}

export interface BusinessRange {
  /** Inclusivo. */
  start: Date
  /** Exclusivo. */
  end: Date
}

/** [00:00 del día, 00:00 del día siguiente) en hora del negocio. */
export function businessDayRange(key: string): BusinessRange {
  return { start: businessDayStart(key), end: businessDayStart(shiftDateKey(key, 1)) }
}

/** Rango de días completos from..to inclusivos. */
export function businessRange(fromKey: string, toKey: string): BusinessRange {
  return { start: businessDayStart(fromKey), end: businessDayStart(shiftDateKey(toKey, 1)) }
}

/** 'YYYY-MM' → [1° del mes, 1° del mes siguiente) en hora del negocio. */
export function businessMonthRange(period: string): BusinessRange {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) throw new Error(`Periodo inválido: ${period}`)
  const next = Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}`
  return { start: businessDayStart(`${period}-01`), end: businessDayStart(`${next}-01`) }
}

/** Mes de negocio ('YYYY-MM') de un instante, desplazado `monthsBack` meses. */
export function businessMonthKey(at: Date = new Date(), monthsBack = 0): string {
  const [y, mo] = businessDateKey(at).split('-').map(Number)
  const idx = y * 12 + (mo - 1) - monthsBack
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Hoy (hora del negocio). */
export function businessToday(at: Date = new Date()): BusinessRange {
  return businessDayRange(businessDateKey(at))
}

/** Límite inferior (inclusivo) de un filtro `from`: 'YYYY-MM-DD' = inicio del día de negocio; otro texto = instante ISO. */
export function fromBound(s: string): Date {
  return KEY_RE.test(s) ? businessDayStart(s) : new Date(s)
}

/** Límite superior (EXCLUSIVO, usar con `lt`) de un filtro `to`: 'YYYY-MM-DD' = fin de ese día de negocio. */
export function toBoundExclusive(s: string): Date {
  return KEY_RE.test(s) ? businessDayStart(shiftDateKey(s, 1)) : new Date(s)
}

/** Hora (0-23) en la zona del negocio. */
export function businessHour(at: Date = new Date()): number {
  return Math.floor(((at.getTime() + offsetMs(at)) % MS_DAY + MS_DAY) % MS_DAY / 3_600_000)
}
