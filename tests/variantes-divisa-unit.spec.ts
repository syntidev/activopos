import { test, expect } from '@playwright/test'
import { priceForMode, resolveLinePrice, variantBases, type PriceMode, type PricingProduct, type PricingVariant } from '../src/lib/pricing'
import { agregarItem, agregarItemConVariante, cambiarModoPrecio, limpiarTicket, type ProductForPOS, type TicketItem } from '../src/lib/pos'

/**
 * Regla única de precio por línea (lib/pricing.ts) y paridad con el POS (lib/pos.ts). Sin servidor ni DB.
 * Producto de referencia (Casco): Full 492, Divisa 400. Por peso: Full 20/kg, Divisa 15/kg.
 */
const RATE = 100

const unitProduct: PricingProduct & { sale_mode: 'unit' } = {
  sale_mode: 'unit', price_per_unit_usd: 492, price_per_kg_usd: null, wholesale_price_usd: 400, wholesale_price_per_kg_usd: null,
}
const noDivisaProduct: PricingProduct & { sale_mode: 'unit' } = { ...unitProduct, wholesale_price_usd: null }
const weightProduct: PricingProduct & { sale_mode: 'weight' } = {
  sale_mode: 'weight', price_per_unit_usd: null, price_per_kg_usd: 20, wholesale_price_usd: null, wholesale_price_per_kg_usd: 15,
}

const v = (price_usd: number | null, precio_extra: number, divisa_price_usd: number | null): PricingVariant => ({ price_usd, precio_extra, divisa_price_usd })

interface Case {
  name: string
  product: PricingProduct & { sale_mode: 'unit' | 'weight' }
  variant?: PricingVariant
  bases: { bcv: number; divisa: number | null }
  bcv: { price: number; source: string }
  divisa: { price: number; source: string }
}

const CASES: Case[] = [
  { name: 'sin variante', product: unitProduct, bases: { bcv: 492, divisa: 400 }, bcv: { price: 492, source: 'bcv' }, divisa: { price: 400, source: 'divisa' } },
  { name: 'producto sin precio Divisa', product: noDivisaProduct, bases: { bcv: 492, divisa: null }, bcv: { price: 492, source: 'bcv' }, divisa: { price: 492, source: 'fallback_bcv' } },
  { name: 'variante sin precio propio', product: unitProduct, variant: v(null, 0, null), bases: { bcv: 492, divisa: 400 }, bcv: { price: 492, source: 'bcv' }, divisa: { price: 400, source: 'divisa' } },
  { name: 'variante con precio_extra', product: unitProduct, variant: v(null, 10, null), bases: { bcv: 502, divisa: 410 }, bcv: { price: 502, source: 'bcv' }, divisa: { price: 410, source: 'divisa' } },
  { name: 'precio_extra con producto sin Divisa', product: noDivisaProduct, variant: v(null, 10, null), bases: { bcv: 502, divisa: null }, bcv: { price: 502, source: 'bcv' }, divisa: { price: 502, source: 'fallback_bcv' } },
  { name: 'Full propio sin Divisa (fallback marcado)', product: unitProduct, variant: v(450, 0, null), bases: { bcv: 450, divisa: null }, bcv: { price: 450, source: 'bcv' }, divisa: { price: 450, source: 'fallback_bcv' } },
  { name: 'Full y Divisa propios', product: unitProduct, variant: v(450, 0, 380), bases: { bcv: 450, divisa: 380 }, bcv: { price: 450, source: 'bcv' }, divisa: { price: 380, source: 'divisa' } },
  { name: 'solo Divisa propio', product: unitProduct, variant: v(null, 0, 390), bases: { bcv: 492, divisa: 390 }, bcv: { price: 492, source: 'bcv' }, divisa: { price: 390, source: 'divisa' } },
  { name: 'solo Divisa propio con precio_extra (no se suma al Divisa propio)', product: unitProduct, variant: v(null, 10, 390), bases: { bcv: 502, divisa: 390 }, bcv: { price: 502, source: 'bcv' }, divisa: { price: 390, source: 'divisa' } },
  { name: 'Divisa propio en 0 cae al Full marcado', product: unitProduct, variant: v(450, 0, 0), bases: { bcv: 450, divisa: 0 }, bcv: { price: 450, source: 'bcv' }, divisa: { price: 450, source: 'fallback_bcv' } },
  { name: 'producto por peso', product: weightProduct, bases: { bcv: 20, divisa: 15 }, bcv: { price: 20, source: 'bcv' }, divisa: { price: 15, source: 'divisa' } },
  { name: 'por peso con precio_extra', product: weightProduct, variant: v(null, 1, null), bases: { bcv: 21, divisa: 16 }, bcv: { price: 21, source: 'bcv' }, divisa: { price: 16, source: 'divisa' } },
]

const asPOS = (p: PricingProduct & { sale_mode: 'unit' | 'weight' }, variants: PricingVariant[] = []): ProductForPOS => ({
  id: 1, name: 'Casco', sale_mode: p.sale_mode, base_unit_label: p.sale_mode === 'weight' ? 'kg' : 'und',
  price_per_unit_usd: p.price_per_unit_usd as number | null, price_per_kg_usd: p.price_per_kg_usd as number | null,
  wholesale_price_usd: p.wholesale_price_usd as number | null, wholesale_price_per_kg_usd: p.wholesale_price_per_kg_usd as number | null,
  cost_per_unit_usd: 5, image_path: null, is_favorite: false, has_variants: variants.length > 0,
  variants: variants.map((x, i) => ({ id: 10 + i, valor: `T${i}`, precio_extra: Number(x.precio_extra), price_usd: x.price_usd as number | null, divisa_price_usd: x.divisa_price_usd as number | null, stock: 5 })),
  stock: { net_qty: 5 },
})

/** Línea que arma el POS (lib/pos.ts) para el producto/variante y el modo del ticket. */
function linePOS(c: Case, mode: PriceMode): TicketItem {
  const base = { ...limpiarTicket(RATE, 0), price_mode: mode }
  const product = asPOS(c.product, c.variant ? [c.variant] : [])
  if (!c.variant) return agregarItem(base, product, 1).items[0]
  const sel = product.variants![0]
  return agregarItemConVariante(base, product, { id: sel.id, name: sel.valor, price_extra_usd: sel.precio_extra, price_usd: sel.price_usd, divisa_price_usd: sel.divisa_price_usd }).items[0]
}

for (const c of CASES) {
  test(`variantBases / resolveLinePrice: ${c.name}`, () => {
    expect(variantBases(c.product, c.variant, c.product.sale_mode)).toEqual(c.bases)
    expect(resolveLinePrice(c.product, c.variant, { mode: 'bcv', saleMode: c.product.sale_mode })).toEqual(c.bcv)
    expect(resolveLinePrice(c.product, c.variant, { mode: 'divisa', saleMode: c.product.sale_mode })).toEqual(c.divisa)
  })

  test(`paridad POS == servidor: ${c.name}`, () => {
    for (const mode of ['bcv', 'divisa'] as const) {
      const server = resolveLinePrice(c.product, c.variant, { mode, saleMode: c.product.sale_mode })
      const pos = linePOS(c, mode)
      expect(pos.price_per_unit_usd, `${mode}: precio`).toBe(server.price)
      expect(pos.price_source, `${mode}: origen`).toBe(server.source)
    }
    // Cambio de modo con el ticket abierto: reprecia a lo mismo que el servidor (y sin sumar precio_extra otra vez).
    const abierto = { ...limpiarTicket(RATE, 0), items: [linePOS(c, 'bcv')] }
    for (const mode of ['divisa', 'bcv', 'divisa'] as const) {
      const server = resolveLinePrice(c.product, c.variant, { mode, saleMode: c.product.sale_mode })
      const repriced = cambiarModoPrecio(abierto, mode).items[0]
      expect(repriced.price_per_unit_usd, `cambio a ${mode}`).toBe(server.price)
      expect(repriced.price_source).toBe(server.source)
    }
  })
}

test('precio manual gana en cualquier modo', () => {
  for (const mode of ['bcv', 'divisa'] as const) {
    expect(resolveLinePrice(unitProduct, v(450, 0, 380), { mode, manualPrice: 300 })).toEqual({ price: 300, source: 'manual' })
  }
})

test('priceForMode: Divisa sin precio (> 0) cae al Full SIEMPRE marcado', () => {
  expect(priceForMode({ bcv: 10, divisa: null }, 'divisa')).toEqual({ price: 10, source: 'fallback_bcv' })
  expect(priceForMode({ bcv: 10, divisa: 0 }, 'divisa')).toEqual({ price: 10, source: 'fallback_bcv' })
  expect(priceForMode({ bcv: 10, divisa: 8 }, 'divisa')).toEqual({ price: 8, source: 'divisa' })
  expect(priceForMode({ bcv: 10, divisa: 8 }, 'bcv')).toEqual({ price: 10, source: 'bcv' })
})

test('tres tallas del Casco: el precio de cada una en cada modo', () => {
  const tallas = [v(null, 0, null), v(492, 0, null), v(492, 0, 400)]
  const esperado = {
    bcv:    [492, 492, 492],
    divisa: [400, 492, 400], // 2.ª: Full propio sin Divisa → Full marcado fallback_bcv
  }
  for (const mode of ['bcv', 'divisa'] as const) {
    tallas.forEach((t, i) => expect(resolveLinePrice(unitProduct, t, { mode }).price).toBe(esperado[mode][i]))
  }
  expect(resolveLinePrice(unitProduct, tallas[1], { mode: 'divisa' }).source).toBe('fallback_bcv')
})
