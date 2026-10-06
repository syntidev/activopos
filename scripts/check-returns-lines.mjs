// Check de src/lib/returns.ts (devolvible por LÍNEA y cierre de la venta).
// Correr: node scripts/check-returns-lines.mjs   (Node >= 22.18: importa el .ts directo)
// Función pura: sin DB, sin red.
//
// Falla si vuelve el bug del 2026-10-06: una línea AMBIGUA (devolución legacy
// sin sale_item_id de un producto que está en varias líneas) daba la venta por
// totalmente devuelta. Eso la marcaba `returned`, estado que el estándar
// contable excluye, y el ingreso de lo que nunca se devolvió desaparecía de
// ventas netas, finanzas y caja.
import assert from 'node:assert/strict'
import { computeReturnableLines, isFullyReturned } from '../src/lib/returns.ts'

// Venta: producto 1 en DOS líneas (ids 10 y 11) + producto 2 en una (id 12).
const lines = [
  { id: 10, product_id: 1, quantity: 1 },
  { id: 11, product_id: 1, quantity: 1 },
  { id: 12, product_id: 2, quantity: 1 },
]

/* ── Caso del bug: devolución legacy ambigua + la otra línea devuelta entera ── */
const conLegacy = computeReturnableLines(lines, [
  { sale_item_id: null, product_id: 1, qty: 1 },  // legacy: no se sabe de cuál línea salió
  { sale_item_id: 12,   product_id: 2, qty: 1 },  // esta sí, completa
])
const amb = conLegacy.filter(l => l.product_id === 1)
assert.ok(amb.every(l => l.ambiguous_legacy_return), 'las 2 líneas del producto 1 deben quedar ambiguas')
assert.ok(amb.every(l => l.qty_returnable === 0), 'una línea ambigua no ofrece cantidad devolvible')
assert.equal(
  isFullyReturned(conLegacy), false,
  'con una línea ambigua la venta NO está totalmente devuelta: queda en partial_return y su ingreso sigue contando',
)

/* ── Devolución legacy imputable: el producto está en UNA sola línea ── */
const unaLinea = [{ id: 20, product_id: 5, quantity: 3 }]
const legacyImputable = computeReturnableLines(unaLinea, [{ sale_item_id: null, product_id: 5, qty: 2 }])
assert.equal(legacyImputable[0].ambiguous_legacy_return, false, 'con una sola línea la legacy sí se imputa')
assert.equal(legacyImputable[0].qty_returned, 2)
assert.equal(legacyImputable[0].qty_returnable, 1)
assert.equal(isFullyReturned(legacyImputable), false, 'queda 1 por devolver')

/* ── Cierre normal: todo devuelto con línea explícita ── */
const todoDevuelto = computeReturnableLines(unaLinea, [{ sale_item_id: 20, product_id: 5, qty: 3 }])
assert.equal(todoDevuelto[0].qty_returnable, 0)
assert.equal(isFullyReturned(todoDevuelto), true, 'sin nada devolvible y sin ambigüedad: returned')

/* ── Nada devuelto ── */
const sinDevolver = computeReturnableLines(lines, [])
assert.deepEqual(sinDevolver.map(l => l.qty_returnable), [1, 1, 1])
assert.equal(isFullyReturned(sinDevolver), false)

/* ── Decimales (peso): no acumula error de coma flotante ── */
const peso = computeReturnableLines([{ id: 30, product_id: 7, quantity: 1.5 }], [
  { sale_item_id: 30, product_id: 7, qty: 0.3 },
  { sale_item_id: 30, product_id: 7, qty: 0.4 },
])
assert.equal(peso[0].qty_returned, 0.7)
assert.equal(peso[0].qty_returnable, 0.8)

console.log('OK — devolvible por línea y cierre de venta intactos (incl. legacy ambigua)')
