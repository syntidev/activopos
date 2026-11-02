import { test, expect } from '@playwright/test'
import {
  agregarItem, agregarItemConVariante, aplicarPreciosServidor, limpiarTicket, lineKey, overridePrecioItem, removeLine,
  sameLine, updateLineQty, type ProductForPOS, type TicketItem, type TicketState,
} from '../src/lib/pos'

/**
 * Identidad de línea del ticket (producto + talla; null y undefined = sin talla). Sin servidor ni DB.
 * Ticket base: producto 1 en 2 tallas (10 y 11) + producto 2 sin talla + producto 3 por peso.
 */
const RATE = 100

const base = (over: Partial<ProductForPOS>): ProductForPOS => ({
  id: 0, name: 'P', sale_mode: 'unit', base_unit_label: 'und', price_per_unit_usd: 10, price_per_kg_usd: null,
  wholesale_price_usd: null, wholesale_price_per_kg_usd: null, cost_per_unit_usd: 5, image_path: null, is_favorite: false,
  stock: { net_qty: 99 }, ...over,
})
const P1 = base({ id: 1, name: 'Casco', price_per_unit_usd: 100, has_variants: true })
const P2 = base({ id: 2, name: 'Gorra', price_per_unit_usd: 20 })
const P3 = base({ id: 3, name: 'Queso', sale_mode: 'weight', base_unit_label: 'kg', price_per_unit_usd: null, price_per_kg_usd: 40 })
const talla = (id: number) => ({ id, name: `T${id}`, price_extra_usd: 0 })

function ticketBase(): TicketState {
  let t = limpiarTicket(RATE, 0)
  t = agregarItemConVariante(t, P1, talla(10), 2)
  t = agregarItemConVariante(t, P1, talla(11), 3)
  t = agregarItem(t, P2, 4)
  t = agregarItem(t, P3, 1.5)
  return t
}

const linea = (t: TicketState, productId: number, variantId: number | null): TicketItem | undefined =>
  t.items.find(i => sameLine(i, productId, variantId))
const qtys = (t: TicketState): Array<[number, number | null, number]> => t.items.map(i => [i.product_id, i.variant_id ?? null, i.quantity])

test('el ticket de prueba tiene las 4 líneas esperadas', () => {
  expect(qtys(ticketBase())).toEqual([[1, 10, 2], [1, 11, 3], [2, null, 4], [3, null, 1.5]])
})

test('sumar y restar afectan SOLO la línea indicada (misma talla, otra talla, sin talla, por peso)', () => {
  const t = ticketBase()
  expect(qtys(updateLineQty(t, 1, 10, 5))).toEqual([[1, 10, 5], [1, 11, 3], [2, null, 4], [3, null, 1.5]])
  expect(qtys(updateLineQty(t, 1, 11, 2))).toEqual([[1, 10, 2], [1, 11, 2], [2, null, 4], [3, null, 1.5]])
  expect(qtys(updateLineQty(t, 2, null, 3))).toEqual([[1, 10, 2], [1, 11, 3], [2, null, 3], [3, null, 1.5]])
  expect(qtys(updateLineQty(t, 3, null, 1.6))).toEqual([[1, 10, 2], [1, 11, 3], [2, null, 4], [3, null, 1.6]])
})

test('los subtotales se recalculan solo en la línea cambiada', () => {
  const t = updateLineQty(ticketBase(), 1, 10, 5)
  expect(linea(t, 1, 10)?.subtotal_usd).toBe(500)
  expect(linea(t, 1, 11)?.subtotal_usd).toBe(300)
  expect(linea(t, 3, null)?.subtotal_usd).toBe(60)
})

test('qty <= 0 elimina solo esa línea', () => {
  const t = ticketBase()
  expect(qtys(updateLineQty(t, 1, 10, 0))).toEqual([[1, 11, 3], [2, null, 4], [3, null, 1.5]])
  expect(qtys(updateLineQty(t, 2, null, -1))).toEqual([[1, 10, 2], [1, 11, 3], [3, null, 1.5]])
  expect(qtys(updateLineQty(t, 3, null, 0))).toEqual([[1, 10, 2], [1, 11, 3], [2, null, 4]])
})

test('eliminar quita SOLO la línea indicada', () => {
  const t = ticketBase()
  expect(qtys(removeLine(t, 1, 11))).toEqual([[1, 10, 2], [2, null, 4], [3, null, 1.5]])
  expect(qtys(removeLine(t, 2, null))).toEqual([[1, 10, 2], [1, 11, 3], [3, null, 1.5]])
  expect(qtys(removeLine(t, 3, undefined))).toEqual([[1, 10, 2], [1, 11, 3], [2, null, 4]])
  // una talla que no existe no toca nada
  expect(qtys(removeLine(t, 1, 99))).toEqual(qtys(t))
})

test('variant_id null y undefined son equivalentes (línea sin talla restaurada de un borrador)', () => {
  const t = ticketBase()
  const conNull: TicketState = { ...t, items: t.items.map(i => (i.product_id === 2 ? { ...i, variant_id: null } : i)) }
  expect(lineKey(2, null)).toBe(lineKey(2, undefined))
  // eliminar (era el bug: filter con !== undefined dejaba la línea con null)
  expect(qtys(removeLine(conNull, 2, undefined))).toEqual([[1, 10, 2], [1, 11, 3], [3, null, 1.5]])
  expect(qtys(removeLine(conNull, 2, null))).toEqual([[1, 10, 2], [1, 11, 3], [3, null, 1.5]])
  // cambiar cantidad
  expect(linea(updateLineQty(conNull, 2, undefined, 9), 2, null)?.quantity).toBe(9)
  // agregar el mismo producto otra vez suma en la MISMA línea (no crea una segunda)
  const sumado = agregarItem(conNull, P2, 1)
  expect(sumado.items.filter(i => i.product_id === 2)).toHaveLength(1)
  expect(linea(sumado, 2, null)?.quantity).toBe(5)
  // override de precio solo en esa línea
  const ov = overridePrecioItem(conNull, 2, undefined, 15)
  expect(linea(ov, 2, null)?.price_per_unit_usd).toBe(15)
  expect(linea(ov, 1, 10)?.price_per_unit_usd).toBe(100)
})

test('agregar la misma talla dos veces suma en la misma línea; otra talla es otra línea', () => {
  let t = ticketBase()
  t = agregarItemConVariante(t, P1, talla(10), 1)
  expect(t.items.filter(i => i.product_id === 1)).toHaveLength(2)
  expect(linea(t, 1, 10)?.quantity).toBe(3)
  t = agregarItemConVariante(t, P1, talla(12), 1)
  expect(t.items.filter(i => i.product_id === 1)).toHaveLength(3)
})

test('override de precio afecta solo la línea indicada (antes, sin talla afectaba todas las del producto)', () => {
  const t = ticketBase()
  const ov = overridePrecioItem(t, 1, 11, 90)
  expect(linea(ov, 1, 11)?.price_per_unit_usd).toBe(90)
  expect(linea(ov, 1, 11)?.price_source).toBe('manual')
  expect(linea(ov, 1, 10)?.price_per_unit_usd).toBe(100)
  expect(linea(ov, 1, 10)?.price_source).not.toBe('manual')
})

test('precios del servidor se aplican por producto + talla, con variant_id null igual a sin talla', () => {
  const t = ticketBase()
  const r = aplicarPreciosServidor(t, 'divisa', [
    { product_id: 2, variant_id: null, price_per_unit_usd: 18, price_source: 'divisa', discount_usd: 0, subtotal_usd: 72 },
    { product_id: 1, variant_id: 11, price_per_unit_usd: 80, price_source: 'divisa', discount_usd: 0, subtotal_usd: 240 },
  ])
  expect(linea(r, 2, null)?.price_per_unit_usd).toBe(18)
  expect(linea(r, 1, 11)?.price_per_unit_usd).toBe(80)
  expect(linea(r, 1, 10)?.price_per_unit_usd).toBe(100)
})
