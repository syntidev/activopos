import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'

/** Importador del menú: simulación, aplicar, segunda corrida sin cambios, revertir deja 0 filas. Negocio de prueba ZZC propio. */
test.describe.configure({ mode: 'serial', timeout: 180_000 })

const NAME = 'ZZC Carta Import'
let bid = 0

const run = (args: string): string =>
  execSync(`npx ts-node --compiler-options "{\\"module\\":\\"commonjs\\"}" scripts/import-cafeconbike.ts ${args}`, { encoding: 'utf8', cwd: process.cwd(), stdio: 'pipe' })
const count = (table: string, where = ''): number => {
  const base = table === 'product_variants'
    ? `SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.business_id=${bid}`
    : `SELECT COUNT(*) FROM ${table} WHERE business_id=${bid}`
  return Number(sql(base + where))
}

function limpiar(): void {
  const ids = sql(`SELECT id FROM businesses WHERE name='${NAME}'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE v FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.business_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id IN (${ids})`)
  sql(`DELETE FROM categories WHERE business_id IN (${ids})`)
  sql(`DELETE FROM businesses WHERE id IN (${ids})`)
}

test.beforeAll(() => {
  limpiar()
  sql(`INSERT INTO businesses (name, catalog_template, updated_at) VALUES ('${NAME}','carta',NOW(3))`)
  bid = Number(sql(`SELECT id FROM businesses WHERE name='${NAME}'`))
})
test.afterAll(() => {
  limpiar()
  expect(Number(sql(`SELECT COUNT(*) FROM businesses WHERE name='${NAME}'`))).toBe(0)
})

test('aborta con negocio inexistente o sin plantilla carta', () => {
  expect(() => run('--business=99999999')).toThrow()
  sql(`UPDATE businesses SET catalog_template='generic' WHERE id=${bid}`)
  expect(() => run(`--business=${bid} --aplicar`)).toThrow()
  sql(`UPDATE businesses SET catalog_template='carta' WHERE id=${bid}`)
  expect(count('products')).toBe(0)
})

test('simulación no escribe; aplicar crea; segunda corrida sin cambios; revertir deja 0', () => {
  const sim = run(`--business=${bid}`)
  expect(sim).toContain('SIMULACIÓN')
  expect(sim).toContain('38 productos, 14 tamaños')
  expect(count('products') + count('categories')).toBe(0)

  const ap = run(`--business=${bid} --aplicar`)
  const respaldo = /Respaldo: (\S+)/.exec(ap)?.[1]
  expect(respaldo, ap).toBeTruthy()
  expect(fs.existsSync(path.resolve(respaldo!))).toBe(true)
  expect(count('categories')).toBe(10)
  expect(count('products')).toBe(38)
  expect(count('product_variants')).toBe(14)
  expect(count('products', ' AND is_featured=1')).toBe(2)
  expect(count('products', " AND catalog_visibility='visible' AND show_in_catalog=1 AND precio_cashea IS NULL AND financing_excluded=0")).toBe(38)
  expect(count('products', ' AND has_variants=1')).toBe(6)

  const otra = run(`--business=${bid} --aplicar`)
  expect(otra).toContain('Nada que crear')
  expect(count('products')).toBe(38)
  expect(count('product_variants')).toBe(14)

  const rev = run(`--business=${bid} --revertir=${respaldo}`)
  expect(rev).toContain('REVERTIDO')
  expect(count('products') + count('categories') + count('product_variants')).toBe(0)
  fs.rmSync(path.resolve(respaldo!))
})
