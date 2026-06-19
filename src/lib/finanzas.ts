export const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// Parsea un string 'YYYY-MM' a { year, month }.
// Lanza si el formato o el mes son inválidos.
export function parsePeriod(period: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m) throw new Error(`Período inválido: ${period}`)
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (month < 1 || month > 12) throw new Error(`Período inválido: ${period}`)
  return { year, month }
}

// Extrae el período de los search params de la request (soporta ?period= y ?month=).
// Default: mes actual.
export function parsePeriodFromParams(sp: URLSearchParams): { year: number; month: number } {
  const raw = sp.get('period') ?? sp.get('month') ?? ''
  try {
    return parsePeriod(raw)
  } catch {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
}
