// Check mínimo de la regla de stock del catálogo (src/lib/catalog.ts).
// Correr: node scripts/check-catalog-stock.mjs
// Falla si un producto con variantes vuelve a decidirse por inventory_entries
// del padre -- el bug que dejó las Franelas 200K invisibles con 80 unidades.
import assert from 'node:assert/strict'

// Copia literal de la regla en src/lib/catalog.ts. Si divergen, este check
// deja de proteger nada: mantener ambas iguales.
function effectiveStock(p) {
  if (p.has_variants && p.variants?.length) return p.variants.reduce((s, v) => s + v.stock, 0)
  return p.net_stock ?? 0
}
function isOutOfStock(p) {
  if (p.sale_mode === 'service') return false
  return effectiveStock(p) <= 0
}
function computeAvailability(p) {
  if (p.availability === 'discontinued') return 'discontinued'
  if (p.sale_mode === 'service')         return 'in_stock'
  const net = effectiveStock(p)
  const min = p.min_stock ?? 0
  if (net <= 0)   return 'out_of_stock'
  if (net <= min) return 'low_stock'
  return 'in_stock'
}

// Caso real del incidente: Franela 200K Niños -- 0 en inventory_entries,
// 60 unidades repartidas en 6 tallas.
const franela = {
  sale_mode: 'unit', availability: 'in_stock', has_variants: true, net_stock: 0, min_stock: 0,
  variants: [{ stock: 10 }, { stock: 10 }, { stock: 10 }, { stock: 10 }, { stock: 10 }, { stock: 10 }],
}
assert.equal(effectiveStock(franela), 60)
assert.equal(isOutOfStock(franela), false)
assert.equal(computeAvailability(franela), 'in_stock')

// Producto con variantes REALMENTE agotado: todas las tallas en 0.
const agotado = { ...franela, variants: [{ stock: 0 }, { stock: 0 }] }
assert.equal(isOutOfStock(agotado), true)
assert.equal(computeAvailability(agotado), 'out_of_stock')

// Producto sin variantes: sigue mandando inventory_entries, sin cambios.
const simple = { sale_mode: 'unit', availability: 'in_stock', has_variants: false, net_stock: 3, min_stock: 5 }
assert.equal(effectiveStock(simple), 3)
assert.equal(computeAvailability(simple), 'low_stock')
assert.equal(computeAvailability({ ...simple, net_stock: 0 }), 'out_of_stock')

// has_variants=true pero sin filas activas -> cae a inventory_entries, no a 0.
assert.equal(effectiveStock({ has_variants: true, variants: [], net_stock: 7 }), 7)

// Servicios y descontinuados: sin cambio de comportamiento.
assert.equal(isOutOfStock({ sale_mode: 'service', net_stock: 0 }), false)
assert.equal(computeAvailability({ sale_mode: 'unit', availability: 'discontinued', net_stock: 99 }), 'discontinued')

console.log('OK — regla de stock del catálogo intacta')
