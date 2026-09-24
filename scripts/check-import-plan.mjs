// Check de la conciliación de importación Excel (src/lib/product-import-plan.ts).
// Correr: node scripts/check-import-plan.mjs   (Node >= 22.18: importa el .ts directo)
// Falla si el archivo vuelve a SUMAR stock, o si un export sin editar deja de
// ser un no-op.
import assert from 'node:assert/strict'
import { planImport } from '../src/lib/product-import-plan.ts'

const base = {
  barcode: null, sku: null, cost_usd: null, category: null, product_type: 'simple',
  sale_mode: 'unit', unit_label: 'und', wholesale_price_usd: null,
  wholesale_price_per_kg_usd: null, location: null, notes: null,
  variant_tipo: null, variant_valor: null, id: null,
}
const exProd = {
  barcode: null, sku: null, category: null, product_type: 'simple', sale_mode: 'unit',
  unit_label: 'und', cost_usd: null, wholesale_price_usd: null,
  wholesale_price_per_kg_usd: null, location: null, notes: null, active: true,
}
const franela = {
  ...exProd, id: 7, name: 'Franela', price_usd: 5, has_variants: true, net_stock: 0,
  variants: [{ id: 70, tipo: 'talla', valor: 'S', stock: 10 }, { id: 71, tipo: 'talla', valor: 'M', stock: 10 }],
}
const gorra = { ...exProd, id: 8, name: 'Gorra', price_usd: 3, has_variants: false, net_stock: 15, variants: [] }
const vrow = (row, valor, stock, extra = {}) =>
  ({ ...base, row, name: 'Franela', price_usd: 5, stock, variant_tipo: 'talla', variant_valor: valor, ...extra })
const plan = (rows, ex = [franela, gorra], owners = new Map()) => planImport(rows, ex, owners)

// 1) Variante existente: REEMPLAZA (10 -> 4), nunca 10 + 4.
let p = plan([vrow(2, 'S', 4), vrow(3, 'M', 10)])
assert.equal(p.errors.length, 0)
assert.equal(p.products.length, 1)
assert.equal(p.products[0].kind, 'update')
assert.deepEqual(p.products[0].variants.map(v => [v.valor, v.action, v.old, v.new]),
  [['S', 'update', 10, 4], ['M', 'same', 10, 10]])

// 2) Variante nueva en producto existente, ubicado por NOMBRE (sin id).
p = plan([vrow(2, 'S', 10), vrow(3, 'M', 10), vrow(4, 'L', 6)])
assert.deepEqual(p.products[0].variants.map(v => v.action), ['same', 'same', 'create'])
assert.equal(p.products[0].product_id, 7)

// 3) Producto inexistente -> crear, con sus variantes agrupadas en UN producto.
p = plan([
  { ...base, row: 2, name: 'Maillot', price_usd: 20, stock: 3, variant_tipo: 'talla', variant_valor: 'S' },
  { ...base, row: 3, name: 'Maillot', price_usd: 20, stock: 5, variant_tipo: 'talla', variant_valor: 'M' },
])
assert.equal(p.products.length, 1)
assert.equal(p.products[0].kind, 'create')
assert.equal(p.products[0].variants.length, 2)

// 4) Export sin editar = no-op ("queda igual"), incluso con neto negativo.
p = plan([vrow(2, 'S', 10), vrow(3, 'M', 10), { ...base, row: 4, id: 8, name: 'Gorra', price_usd: 3, stock: 15 }])
assert.deepEqual(p.products.map(x => x.kind), ['same', 'same'])
p = plan([{ ...base, row: 2, id: 8, name: 'Gorra', price_usd: 3, stock: 0 }], [franela, { ...gorra, net_stock: -2 }])
assert.equal(p.products[0].kind, 'same')

// 5) Simple existente: reemplaza contra el neto; delta es contra el neto REAL.
p = plan([{ ...base, row: 2, id: 8, name: 'Gorra', price_usd: 3, stock: 9 }])
assert.deepEqual(p.products[0].stock, { old: 15, new: 9, delta: -6 })
p = plan([{ ...base, row: 2, id: 8, name: 'Gorra', price_usd: 3, stock: 5 }], [franela, { ...gorra, net_stock: -2 }])
assert.equal(p.products[0].stock.delta, 7)

// 6) Errores: mezcla, forma incompatible, duplicados, id inexistente, nombre ambiguo.
p = plan([vrow(2, 'S', 1), { ...base, row: 3, name: 'Franela', price_usd: 5, stock: 1 }])
assert.equal(p.errors.length, 1); assert.equal(p.errors[0].row, 3)
p = plan([{ ...base, row: 2, id: 7, name: 'Franela', price_usd: 5, stock: 1 }])          // variantes sin variante_valor
assert.equal(p.products.length, 0); assert.equal(p.errors.length, 1)
p = plan([{ ...vrow(2, 'S', 1), name: 'Gorra' }])                                        // tallas sobre producto simple
assert.equal(p.products.length, 0); assert.equal(p.errors.length, 1)
p = plan([vrow(2, 'S', 1), vrow(3, 's', 2)])                                             // misma variante dos veces
assert.equal(p.errors.length, 1); assert.equal(p.products[0].variants.length, 1)
p = plan([{ ...base, row: 2, id: 99, name: 'X', price_usd: 1, stock: 1 }])
assert.match(p.errors[0].message, /no encontrado/)
p = plan([{ ...base, row: 2, name: 'Gorra', price_usd: 3, stock: 1 }], [gorra, { ...gorra, id: 9 }])
assert.match(p.errors[0].message, /2 productos/)

// 7) Barcode ajeno se rechaza; el propio no.
p = plan([{ ...base, row: 2, id: 8, name: 'Gorra', price_usd: 3, stock: 15, barcode: '123' }], [franela, gorra], new Map([['123', 999]]))
assert.match(p.errors[0].message, /ya pertenece/)
p = plan([{ ...base, row: 2, id: 8, name: 'Gorra', price_usd: 3, stock: 15, barcode: '123' }], [franela, { ...gorra, barcode: '123' }], new Map([['123', 8]]))
assert.equal(p.errors.length, 0)

console.log('OK — conciliación de importación intacta')
