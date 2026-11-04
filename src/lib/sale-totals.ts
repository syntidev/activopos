/**
 * Total de una venta pendiente a partir de lo guardado: líneas (ya netas de su descuento) x descuento global x cargo global.
 * Mismo redondeo por etapas que calcularTotales() de lib/pos.ts, para que pantalla == sales.total_usd al centavo.
 */
const r2 = (x: number): number => Math.round(x * 100) / 100

export function pendingSaleTotals(itemsUsd: number, discountPct: number, cargoPct: number, rate: number): { total_usd: number; total_bs: number } {
  const subtotal = r2(itemsUsd)
  const afterDiscount = r2(subtotal - r2(subtotal * (discountPct / 100)))
  const total_usd = r2(afterDiscount + r2(afterDiscount * (cargoPct / 100)))
  return { total_usd, total_bs: r2(total_usd * rate) }
}
