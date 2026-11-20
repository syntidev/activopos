import { test, expect } from '@playwright/test'
import { canonizarTalla, euDe, usDe } from '../src/lib/talla-canonica'

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

test('helpers del filtro: euDe / usDe', () => {
  expect(euDe('EU 42.5 · US 9')).toBe('42.5')
  expect(euDe('42')).toBe('42')
  expect(euDe('M')).toBeNull()
  expect(usDe('EU 42.5 · US 9')).toBe('US 9')
  expect(usDe('XL')).toBeNull()
})
