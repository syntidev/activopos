/**
 * Alta rápida — reglas puras compartidas entre cliente y servidor.
 * Sin imports de servidor (prisma, next/headers): este módulo se bundlea al cliente.
 */

/** Código de barras aceptado (EAN/UPC/Code128): products.barcode admite hasta 50. */
export const CODE_RE = /^[A-Za-z0-9-]{4,50}$/

/** Formato sellado: USD y Bs siempre juntos ("$15.00" / "Bs. 8,951.73"). */
export function formatUsd(usd: number): string {
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatBs(usd: number, rate: number): string {
  return `Bs. ${(usd * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "12,5" o "12.50" → 12.5. NaN si está vacío o no es número. */
export function parseMoney(raw: string): number {
  const s = raw.trim().replace(',', '.')
  return s === '' ? NaN : Number(s)
}
