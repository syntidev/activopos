import type { DiningTableDTO, OpenAccountRef, TableStatus } from '@/types/restaurante'

/**
 * Módulo Restaurante — lógica PURA (sin Prisma ni next/server), segura para el cliente.
 * La puerta de acceso y los esquemas del servidor viven en restaurante-server.ts.
 */

export const SEARCH_MAX_LEN = 60
export const SEARCH_MAX_TOKENS = 5

/**
 * Estado de mesa DERIVADO. No existe columna "ocupada": si la guardáramos podría
 * contradecir la cuenta. Prioridad: lo que pasa en la cuenta manda sobre las marcas.
 */
export function tableStatus(
  table: Pick<DiningTableDTO, 'cleaning_pending' | 'reserved_for'>,
  account?: OpenAccountRef | null,
): TableStatus {
  if (account?.account_status === 'bill_requested') return 'por_cobrar'
  if (account?.account_status === 'open') return 'ocupada'
  if (table.cleaning_pending) return 'por_limpiar'
  if (table.reserved_for) return 'reservada'
  return 'libre'
}

/** Sin acentos ni mayúsculas: "salon" encuentra "Salón". */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Palabras de la búsqueda: máx. 5 y 60 caracteres, igual que el servidor. */
export function searchTokens(raw: string): string[] {
  return foldText(raw.trim().slice(0, SEARCH_MAX_LEN)).split(/\s+/).filter(Boolean).slice(0, SEARCH_MAX_TOKENS)
}

/**
 * Búsqueda híbrida (CLAUDE.md): AND entre palabras, OR entre campos.
 * "salon 2" = mesa "2" del área "Salón".
 */
export function matchesTableSearch(
  table: Pick<DiningTableDTO, 'label' | 'area_name' | 'reserved_for'>,
  tokens: readonly string[],
): boolean {
  if (tokens.length === 0) return true
  const fields = [table.label, table.area_name, table.reserved_for ?? ''].map(foldText)
  return tokens.every(t => fields.some(f => f.includes(t)))
}

/* ── Dinero: USD y Bs siempre juntos, formato sellado ($15.00 / Bs. 8,951.73) ── */

export const formatUsd = (n: number): string => '$' + n.toFixed(2)
export const formatBs = (n: number): string => `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Minutos transcurridos desde un instante ISO ("24 min", "1 h 12 min"). */
export function elapsedLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`
}

/* ── Geometría del plano (unidades = celdas de la cuadrícula) ── */

export interface Box { x: number; y: number; w: number; h: number }

/** Caja visible: a 90° y 270° el ancho y el alto se intercambian. pos_x/pos_y = esquina superior izquierda. */
export function renderedSize(width: number, height: number, rotation: number): { w: number; h: number } {
  return rotation % 180 === 90 ? { w: height, h: width } : { w: width, h: height }
}

/** Límite de la cuadrícula del plano, en celdas. */
export const GRID_MAX = 60
const AUTO_COLS = 14

/** Primer hueco libre del plano (con 1 celda de aire) para algo de w×h. Si no hay, vuelve al origen. */
export function freeSpot(taken: readonly Box[], w: number, h: number): { x: number; y: number } {
  for (let y = 1; y <= GRID_MAX - h; y++) {
    for (let x = 1; x <= AUTO_COLS - w; x++) {
      const clash = taken.some(b => x < b.x + b.w + 1 && x + w + 1 > b.x && y < b.y + b.h + 1 && y + h + 1 > b.y)
      if (!clash) return { x, y }
    }
  }
  return { x: 1, y: 1 }
}

const CHAIR_LONG = 0.5
const CHAIR_SHORT = 0.3
const CHAIR_GAP = 0.1

/**
 * Sillas DERIVADAS de la capacidad (no se guardan), relativas a la esquina de la mesa.
 * Redonda: en círculo. Cuadrada: 1 por lado hasta 4; con 5+ o mesa ancha, repartidas por arriba y abajo.
 * Los taburetes no llevan sillas.
 */
export function chairBoxes(w: number, h: number, capacity: number, shape: DiningTableDTO['shape']): Box[] {
  if (shape === 'stool' || capacity <= 0) return []
  const out: Box[] = []
  if (shape === 'round') {
    const radius = Math.min(w, h) / 2 + CHAIR_GAP + CHAIR_SHORT / 2
    for (let i = 0; i < capacity; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / capacity
      out.push({ x: w / 2 + radius * Math.cos(a) - CHAIR_SHORT / 2, y: h / 2 + radius * Math.sin(a) - CHAIR_SHORT / 2, w: CHAIR_SHORT, h: CHAIR_SHORT })
    }
    return out
  }
  let top: number, bottom: number, left: number, right: number
  if (w >= 3 && capacity >= 4) {
    top = Math.ceil(capacity / 2); bottom = capacity - top; left = right = 0
  } else if (capacity <= 4) {
    top = capacity > 0 ? 1 : 0; bottom = capacity > 1 ? 1 : 0; left = capacity > 2 ? 1 : 0; right = capacity > 3 ? 1 : 0
  } else {
    left = right = 1; top = Math.ceil((capacity - 2) / 2); bottom = capacity - 2 - top
  }
  const row = (n: number, y: number): void => { for (let i = 0; i < n; i++) out.push({ x: ((i + 1) * w) / (n + 1) - CHAIR_LONG / 2, y, w: CHAIR_LONG, h: CHAIR_SHORT }) }
  const col = (n: number, x: number): void => { for (let i = 0; i < n; i++) out.push({ x, y: ((i + 1) * h) / (n + 1) - CHAIR_LONG / 2, w: CHAIR_SHORT, h: CHAIR_LONG }) }
  row(top, -CHAIR_GAP - CHAIR_SHORT)
  row(bottom, h + CHAIR_GAP)
  col(left, -CHAIR_GAP - CHAIR_SHORT)
  col(right, w + CHAIR_GAP)
  return out
}

/** Etiqueta corta bajo el número de mesa en el plano y en las fichas. */
export function statusLabel(
  status: TableStatus,
  table: Pick<DiningTableDTO, 'capacity' | 'reserved_at' | 'account_opened_at' | 'account_total_usd'>,
): string {
  switch (status) {
    case 'ocupada':     return elapsedLabel(table.account_opened_at) || 'ocupada'
    case 'por_cobrar':  return table.account_total_usd !== null ? formatUsd(table.account_total_usd) : 'por cobrar'
    case 'por_limpiar': return 'limpiar'
    case 'reservada':   return table.reserved_at ? formatHour(table.reserved_at) : 'reservada'
    case 'libre':       return `${table.capacity} pers`
  }
}

function formatHour(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'reservada' : d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false })
}
