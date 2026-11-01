import { fmtBs, fmtUsd } from '@/app/catalogo-premium/[slug]/catalogUtils'

export { fmtBs, fmtUsd }

/** Unidades: enteras o hasta 2 decimales (ventas por peso). */
export function fmtQty(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 })
}

export interface Delta { text: string; dir: 'up' | 'down' | 'flat' | 'new' }

/** Variación de unidades contra el período anterior. Sin base previa: "Nuevo" (o sin cambio si ambos son 0). */
export function deltaQty(qty: number, prev: number): Delta {
  if (prev === 0) return qty > 0 ? { text: 'Nuevo', dir: 'new' } : { text: '0%', dir: 'flat' }
  const pct = Math.round(((qty - prev) / Math.abs(prev)) * 1000) / 10
  if (pct === 0) return { text: '0%', dir: 'flat' }
  return { text: `${Math.abs(pct).toLocaleString('es-VE')}%`, dir: pct > 0 ? 'up' : 'down' }
}

/** Mensaje de error de una respuesta no-OK, con el texto del contrato ({ error }). */
export async function apiError(res: Response): Promise<string> {
  const j = await res.json().catch(() => null) as { error?: string } | null
  return j?.error ?? `Error ${res.status}`
}
