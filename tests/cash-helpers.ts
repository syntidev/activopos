import type { APIRequestContext } from '@playwright/test'

const OPENING_USD = 25

async function activeRate(api: APIRequestContext): Promise<number> {
  const body = await (await api.get('/api/rates/bcv')).json() as { ok?: boolean; rate?: number }
  if (!body.ok || !body.rate) throw new Error('Pre-condición: tasa BCV no disponible')
  return body.rate
}

/**
 * Abre una caja PROPIA si el tenant no tiene una abierta. Devuelve true si la abrió este spec (y por tanto debe
 * cerrarla con closeOwnCashRegister); false si ya había una abierta, que no es nuestra y no se toca.
 */
export async function openOwnCashRegister(api: APIRequestContext): Promise<boolean> {
  const status = await (await api.get('/api/cash/status')).json() as { isOpen: boolean }
  if (status.isOpen) return false
  const rate = await activeRate(api)
  const open = await api.post('/api/cash/open', { data: { opening_amount_usd: OPENING_USD, opening_amount_bs: OPENING_USD * rate } })
  if (!open.ok()) throw new Error(`No se pudo abrir la caja propia del spec: HTTP ${open.status()}`)
  return true
}

/** Cierra la caja abierta por openOwnCashRegister. */
export async function closeOwnCashRegister(api: APIRequestContext): Promise<void> {
  const rate = await activeRate(api)
  await api.post('/api/cash/close', {
    data: { closing_amount_usd: OPENING_USD, closing_amount_bs: OPENING_USD * rate, close_notes: 'Cierre de la caja propia del spec' },
  })
}
