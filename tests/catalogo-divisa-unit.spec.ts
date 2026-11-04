import { test, expect } from '@playwright/test'
import { divisaPriceOf } from '../src/lib/catalog-divisa'

/** Regla única del precio Divisa del catálogo: 0 < divisa < precio Cashea, si no null. Sin servidor ni DB. */
const p = (full: number | null, divisa: number | null, kg: number | null = null, divisaKg: number | null = null) => ({
  price_per_unit_usd: full, price_per_kg_usd: kg, wholesale_price_usd: divisa, wholesale_price_per_kg_usd: divisaKg,
})

test('divisa < full -> divisa', () => expect(divisaPriceOf(p(825, 650))).toBe(650))
test('divisa = full -> null', () => expect(divisaPriceOf(p(100, 100))).toBeNull())
test('divisa > full (fenix 47 mm: 1210 vs 1100) -> null', () => expect(divisaPriceOf(p(1100, 1210))).toBeNull())
test('divisa 0 o null -> null', () => {
  expect(divisaPriceOf(p(100, 0))).toBeNull()
  expect(divisaPriceOf(p(100, null))).toBeNull()
})
test('por kilo usa los precios por kilo', () => {
  expect(divisaPriceOf(p(null, null, 10, 8))).toBe(8)
  expect(divisaPriceOf(p(null, null, 10, 12))).toBeNull()
})
