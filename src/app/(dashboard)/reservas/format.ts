import type { ReservaColumn, ReservaDTO } from '@/types/reservas'

/** Columna del Kanban: depende SOLO de armado/entregado, nunca del pago. */
export function columnOf(r: Pick<ReservaDTO, 'armado' | 'entregado'>): ReservaColumn {
  if (r.entregado) return 'entregado'
  if (r.armado) return 'armado'
  return 'pendiente'
}

const MIN_PHONE_DIGITS = 3

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Búsqueda híbrida (mismo criterio que /api/reservas/search): cada palabra debe
 * aparecer en ticket_number, cliente_nombre o cliente_telefono. Ignora
 * mayúsculas y acentos; el teléfono también se compara solo por dígitos.
 */
export function matchesSearch(
  r: Pick<ReservaDTO, 'ticket_number' | 'cliente_nombre' | 'cliente_telefono'>,
  query: string,
): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const fields = [fold(r.ticket_number), fold(r.cliente_nombre), fold(r.cliente_telefono ?? '')]
  const phoneDigits = (r.cliente_telefono ?? '').replace(/\D/g, '')
  return tokens.every(token => {
    const digits = token.replace(/\D/g, '')
    return (
      fields.some(f => f.includes(token)) ||
      (digits.length >= MIN_PHONE_DIGITS && phoneDigits.includes(digits))
    )
  })
}

const NUMBER_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

export function formatUsd(usd: number): string {
  return `$${usd.toLocaleString('en-US', NUMBER_FORMAT)}`
}

/** Bs = USD × tasa BCV. Sin tasa devuelve null (nunca se bloquea por falta de tasa). */
export function formatBs(usd: number, rate: number | null): string | null {
  if (!rate) return null
  return `Bs. ${(usd * rate).toLocaleString('en-US', NUMBER_FORMAT)}`
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
}
