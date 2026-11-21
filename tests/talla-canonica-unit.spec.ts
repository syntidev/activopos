import { test, expect } from '@playwright/test'
import { canonizarTalla, euDe, numeroTalla, usDe } from '../src/lib/talla-canonica'
import { parseSearch, valueHasToken } from '../src/lib/product-search'
import { chipsDeTallas, productoTieneTalla } from '../src/app/catalogo-premium/[slug]/tallas'

/** Unitaria de src/lib/talla-canonica.ts con los valores reales del incidente del negocio 33 (20-nov). */
const ok = (entrada: string, valor: string, grupo: string, ctx = {}): void => {
  expect(canonizarTalla(entrada, ctx), entrada).toEqual({ valor, tipo: 'talla', grupo })
}
const mal = (entrada: string, patron: RegExp): void => {
  const r = canonizarTalla(entrada)
  expect('error' in r ? r.error : `OK ${JSON.stringify(r)}`, entrada).toMatch(patron)
}

test('calzado: EU primero, US si lo trae; número suelto 34–50 es EU', () => {
  ok('US 9 · EU 42.5', 'EU 42.5 · US 9', 'calzado')
  ok('EU 42.5 · US 9', 'EU 42.5 · US 9', 'calzado')
  ok('EU 45', 'EU 45', 'calzado')
  ok('42', 'EU 42', 'calzado')
  ok('42,5', 'EU 42.5', 'calzado')
  ok('talla 45', 'EU 45', 'calzado')
  ok('41', 'EU 41', 'calzado')
  ok('EU 42 · M9 / W10.5', 'EU 42 · M9 / W10.5', 'calzado')
})

test('calzado sin EU: error claro que pide EU', () => {
  mal('M9 / W10.5', /sin EU/)
  mal('US 9', /sin EU/)
})

test('ropa adulto: XXL→2XL, TALLA M→M, minúsculas y rangos', () => {
  ok('TALLA M', 'M', 'ropa')
  ok('TALLA m', 'M', 'ropa')
  ok('m', 'M', 'ropa')
  ok('xxl', '2XL', 'ropa')
  ok('XL', 'XL', 'ropa')
  ok('4xl', '4XL', 'ropa')
  ok('S-M', 'S/M', 'ropa')
  ok('XS-S', 'XS/S', 'ropa')
  ok('L/XL', 'L/XL', 'ropa')
  ok('L - xl', 'L/XL', 'ropa')
})

test('única es válida; niños 2–16 entero', () => {
  ok('ÚNICA', 'Única', 'ropa')
  ok('unica', 'Única', 'ropa')
  ok('8', '8', 'ninos')
  ok('14', '14', 'ninos')
})

test('inválidas: POR DEFINIR, vacío, irreconocible, ambiguas', () => {
  mal('POR DEFINIR', /no reconocida/)
  mal('', /vacía/)
  mal('   ', /vacía/)
  mal('rojo', /no reconocida/)
  mal('25', /ambigua|fuera de rango/)
  mal('9.5', /ambigua|fuera de rango/)
})

test('contexto calzado: EU infantil 28–33 es válido', () => {
  ok('30', 'EU 30', 'calzado', { calzado: true })
})

const HOKA = ['EU 41 1/3 · US 8', 'EU 42 2/3 · US 9', 'EU 44 2/3 · US 10.5', 'EU 45 1/3 · US 11'] // v352 v371 v394 v395 (negocio 33)

test('tercios Hoka: se conservan tal cual (no pierden la fracción)', () => {
  for (const v of HOKA) ok(v, v, 'calzado')
  ok('US 8 · EU 41 1/3', 'EU 41 1/3 · US 8', 'calzado')
  ok('EU 41  1/3', 'EU 41 1/3', 'calzado') // espacios de más
  ok('42 2/3', 'EU 42 2/3', 'calzado')
  ok('42,5', 'EU 42.5', 'calzado') // el decimal sigue igual
  ok('EU 42 · M9 / W10.5', 'EU 42 · M9 / W10.5', 'calzado')
  mal('EU 60 1/3', /fuera de rango/)
})

test('tercios Hoka: euDe y token de búsqueda', () => {
  expect(HOKA.map(v => euDe(v))).toEqual(['41 1/3', '42 2/3', '44 2/3', '45 1/3'])
  expect(numeroTalla('42 2/3')).toBeCloseTo(42.667, 2)
  expect(valueHasToken('EU 42 2/3 · US 9', '42 2/3')).toBe(true)
  expect(valueHasToken('EU 42 2/3 · US 9', '42')).toBe(false) // 42 no trae 42 2/3 (igual que no trae 42.5)
  expect(valueHasToken('EU 42 2/3 · US 9', '2')).toBe(false)
  expect(valueHasToken('EU 42 · US 9', '42')).toBe(true)
  expect(parseSearch('eu 42 2/3').sizes).toEqual(['42 2/3'])
  expect(parseSearch('talla 41 1/3').sizes).toEqual(['41 1/3'])
  expect(parseSearch('42 2/3').sizes).toEqual(['42 2/3'])
  expect(parseSearch('eu 42').sizes).toEqual(['42'])
})

test('tercios Hoka: chips del filtro, orden y OR por talla', () => {
  const p = { variants: [...HOKA, 'EU 42 · US 8.5'].map(valor => ({ tipo: 'talla', valor, soldOut: false })) }
  const { calzado } = chipsDeTallas([p])
  expect(calzado.map(c => c.key)).toEqual(['EU 41 1/3', 'EU 42', 'EU 42 2/3', 'EU 44 2/3', 'EU 45 1/3'])
  expect(calzado.find(c => c.key === 'EU 42 2/3')?.us).toBe('US 9')
  const solo = { variants: [{ tipo: 'talla', valor: 'EU 42 2/3 · US 9', soldOut: false }] }
  expect(productoTieneTalla(solo, ['EU 42'])).toBe(false)
  expect(productoTieneTalla(solo, ['EU 42 2/3'])).toBe(true)
})

test('helpers del filtro: euDe / usDe', () => {
  expect(euDe('EU 42.5 · US 9')).toBe('42.5')
  expect(euDe('42')).toBe('42')
  expect(euDe('M')).toBeNull()
  expect(usDe('EU 42.5 · US 9')).toBe('US 9')
  expect(usDe('XL')).toBeNull()
})
