/** Formato de dinero de Pedidos: USD y Bs siempre juntos. */
export const usd = (n: number | string): string =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const bs = (n: number | string): string =>
  `Bs ${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "$222.00 · Bs 203.495,79" (Bs = USD × tasa). Sin tasa, solo USD. */
export const dual = (usdAmount: number | string, rate: number): string =>
  rate > 0 ? `${usd(usdAmount)} · ${bs(Number(usdAmount) * rate)}` : usd(usdAmount)
