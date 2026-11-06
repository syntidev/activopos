import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { test, expect } from '@playwright/test'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * scripts/import-cafeconbike.ts con grupos de opciones: simulación, --aplicar, idempotencia, opción faltante, reubicación del
 * Ceviche, respaldo y --revertir. Corre contra el negocio propio (E2E_BUSINESS_ID) convertido TEMPORALMENTE a plantilla carta;
 * al final queda sin nada de lo importado y con su plantilla original. No necesita servidor.
 */
const ROOT = path.join(__dirname, '..')
const BID = ownBusiness().businessId
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'data', 'cafeconbike-menu.json'), 'utf-8')) as { categorias: { nombre: string }[]; productos: { nombre: string; categoria: string }[] }
const ops = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'data', 'cafeconbike-opciones.json'), 'utf-8')) as { grupos: { producto: string; grupo: string; obligatorio: boolean; multiple: boolean; opciones: string[] }[] }
const N_GRUPOS = ops.grupos.length
const N_OPCIONES = ops.grupos.reduce((n, x) => n + x.opciones.length, 0)

test.describe.configure({ mode: 'serial', timeout: 300_000 })

let plantillaOriginal = 'generic'
const respaldos: string[] = []

interface Salida { code: number; out: string }
function importar(...args: string[]): Salida {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', 'tests/tsconfig.json', 'scripts/import-cafeconbike.ts', `--business=${BID}`, ...args], { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

const respaldoDe = (out: string): string => {
  const m = out.match(/Respaldo: (\S+)/)
  expect(m, out).not.toBeNull()
  const file = path.join(ROOT, (m as RegExpMatchArray)[1])
  respaldos.push(file)
  return file
}

const q = (s: string): string => `'${s.replace(/'/g, "''")}'`
const nombresMenu = menu.productos.map(p => q(p.nombre)).join(',')
const nombresCats = menu.categorias.map(c => q(c.nombre)).join(',')
const conteo = {
  grupos: () => Number(sql(`SELECT COUNT(*) FROM product_option_groups g JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID}`)),
  opciones: () => Number(sql(`SELECT COUNT(*) FROM product_options o JOIN product_option_groups g ON g.id=o.group_id JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID}`)),
  productos: () => Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name IN (${nombresMenu})`)),
  categorias: () => Number(sql(`SELECT COUNT(*) FROM categories WHERE business_id=${BID} AND name IN (${nombresCats})`)),
}
const categoriaDe = (producto: string): string => sql(`SELECT c.name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.business_id=${BID} AND p.name=${q(producto)}`)

function limpiar(): void {
  sql(`DELETE FROM product_options WHERE group_id IN (SELECT g.id FROM product_option_groups g JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID} AND p.name IN (${nombresMenu}))`)
  sql(`DELETE FROM product_option_groups WHERE product_id IN (SELECT id FROM products WHERE business_id=${BID} AND name IN (${nombresMenu}))`)
  sql(`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE business_id=${BID} AND name IN (${nombresMenu}))`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name IN (${nombresMenu})`)
  sql(`DELETE FROM categories WHERE business_id=${BID} AND name IN (${nombresCats}) AND id NOT IN (SELECT category_id FROM products WHERE category_id IS NOT NULL)`)
}

test.beforeAll(() => {
  plantillaOriginal = sql(`SELECT IFNULL(catalog_template,'generic') FROM businesses WHERE id=${BID}`)
  limpiar()
})

test.afterAll(() => {
  limpiar()
  sql(`UPDATE businesses SET catalog_template='${plantillaOriginal}' WHERE id=${BID}`)
  for (const f of respaldos) if (fs.existsSync(f)) fs.unlinkSync(f)
  expect(conteo.productos() + conteo.grupos() + conteo.categorias()).toBe(0)
})

test('aborta si el negocio no tiene plantilla carta (no escribe nada)', () => {
  sql(`UPDATE businesses SET catalog_template='generic' WHERE id=${BID}`)
  const r = importar('--aplicar')
  expect(r.code).toBe(1)
  expect(r.out).toContain('no tiene plantilla carta')
  expect(conteo.productos()).toBe(0)
  sql(`UPDATE businesses SET catalog_template='carta' WHERE id=${BID}`)
})

test('los datos versionados son coherentes: 14 productos con grupos, ceviche en Cortes de carne', () => {
  expect(N_GRUPOS).toBe(18)
  expect(new Set(ops.grupos.map(x => x.producto)).size).toBe(14)
  expect(menu.productos.find(p => p.nombre === 'Ceviche de Cochino')?.categoria).toBe('Cortes de carne')
  for (const x of ops.grupos) expect(menu.productos.some(p => p.nombre === x.producto), x.producto).toBe(true)
})

test('simulación: lista grupos y opciones y NO escribe', () => {
  const r = importar()
  expect(r.code, r.out).toBe(0)
  expect(r.out).toContain('SIMULACIÓN')
  expect(r.out).toContain(`${N_GRUPOS} grupos de opciones, ${N_OPCIONES} opciones`)
  expect(r.out).toContain('+ grupo [Pollo Crispy] Preparación del pollo (obligatorio, una): A la broster, Asado')
  expect(r.out).toContain('Sin cambios')
  expect(conteo.productos() + conteo.grupos() + conteo.categorias()).toBe(0)
})

test('--aplicar crea productos, grupos y opciones exactos y guarda el respaldo', () => {
  const r = importar('--aplicar')
  expect(r.code, r.out).toBe(0)
  const file = respaldoDe(r.out)
  expect(conteo.grupos()).toBe(N_GRUPOS)
  expect(conteo.opciones()).toBe(N_OPCIONES)
  expect(conteo.productos()).toBe(menu.productos.length)
  // cada grupo del JSON: reglas, opciones y orden exactos
  for (const x of ops.grupos) {
    const fila = sql(`SELECT CONCAT(g.required,g.multiple,IFNULL(g.max_select,'-'),'|',(SELECT GROUP_CONCAT(o.name ORDER BY o.sort_order SEPARATOR ',') FROM product_options o WHERE o.group_id=g.id)) FROM product_option_groups g JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID} AND p.name=${q(x.producto)} AND g.name=${q(x.grupo)}`)
    expect(fila, `${x.producto} › ${x.grupo}`).toBe(`${x.obligatorio ? 1 : 0}${x.multiple ? 1 : 0}-|${x.opciones.join(',')}`)
  }
  // el orden de los grupos de un producto sigue el JSON
  expect(sql(`SELECT GROUP_CONCAT(g.name ORDER BY g.sort_order SEPARATOR ' > ') FROM product_option_groups g JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID} AND p.name='Pollo Crispy'`)).toBe('Preparación del pollo > Tocineta')
  expect(categoriaDe('Ceviche de Cochino')).toBe('Cortes de carne')
  const resp = JSON.parse(fs.readFileSync(file, 'utf-8')) as { aplicado: boolean; creado_ids: { grupos: number[]; opciones: number[]; productos: number[] }; movidos: unknown[] }
  expect(resp.aplicado).toBe(true)
  expect(resp.creado_ids.grupos).toHaveLength(N_GRUPOS)
  expect(resp.creado_ids.opciones).toHaveLength(N_OPCIONES)
  expect(resp.creado_ids.productos).toHaveLength(menu.productos.length)
  expect(resp.movidos).toEqual([])
})

test('idempotente: una segunda corrida no crea nada', () => {
  const r = importar('--aplicar')
  expect(r.code, r.out).toBe(0)
  expect(r.out).toContain('Nada que crear')
  expect(conteo.grupos()).toBe(N_GRUPOS)
  expect(conteo.opciones()).toBe(N_OPCIONES)
  expect(conteo.productos()).toBe(menu.productos.length)
})

test('un grupo existente solo recibe las opciones que le faltan (y no se toca lo demás)', () => {
  const gid = sql(`SELECT g.id FROM product_option_groups g JOIN products p ON p.id=g.product_id WHERE p.business_id=${BID} AND p.name='Pollo Crispy' AND g.name='Tocineta'`)
  sql(`DELETE FROM product_options WHERE group_id=${gid} AND name='Pavo'`)
  sql(`UPDATE product_options SET price_extra_usd=2.50 WHERE group_id=${gid} AND name='Cochino'`) // un cambio del admin se respeta
  const sim = importar()
  expect(sim.out).toContain('+ opciones en [Pollo Crispy] Tocineta: Pavo')
  expect(sim.out).toContain('0 grupos de opciones, 1 opciones')
  const r = importar('--aplicar')
  respaldoDe(r.out)
  expect(conteo.opciones()).toBe(N_OPCIONES)
  expect(sql(`SELECT price_extra_usd FROM product_options WHERE group_id=${gid} AND name='Cochino'`)).toBe('2.50')
  expect(sql(`SELECT GROUP_CONCAT(name ORDER BY sort_order SEPARATOR ',') FROM product_options WHERE group_id=${gid}`)).toBe('Cochino,Pavo')
})

test('Ceviche de Cochino: se mueve desde la categoría vieja, se respeta si el admin lo reubicó, y el respaldo lo devuelve', () => {
  const cat = (n: string): string => sql(`SELECT id FROM categories WHERE business_id=${BID} AND name=${q(n)}`)
  // el admin lo reubicó a mano en otra categoría: NO se toca
  sql(`UPDATE products SET category_id=${cat('Keto')} WHERE business_id=${BID} AND name='Ceviche de Cochino'`)
  const respeta = importar()
  expect(respeta.out).not.toContain('~ mover')
  expect(categoriaDe('Ceviche de Cochino')).toBe('Keto')

  // sigue en la categoría de la importación anterior: se mueve a Cortes de carne
  sql(`UPDATE products SET category_id=${cat('Pescado y mar')} WHERE business_id=${BID} AND name='Ceviche de Cochino'`)
  const sim = importar()
  expect(sim.out).toContain('~ mover Ceviche de Cochino: Pescado y mar → Cortes de carne')
  expect(sim.out).toContain('1 movidos')
  expect(categoriaDe('Ceviche de Cochino')).toBe('Pescado y mar') // la simulación no escribe
  const r = importar('--aplicar')
  const file = respaldoDe(r.out)
  expect(categoriaDe('Ceviche de Cochino')).toBe('Cortes de carne')
  expect(JSON.parse(fs.readFileSync(file, 'utf-8')).movidos).toHaveLength(1)

  // revertir ESA corrida devuelve el ceviche a su categoría anterior y no toca nada más
  const rev = importar(`--revertir=${path.relative(ROOT, file)}`)
  expect(rev.code, rev.out).toBe(0)
  expect(rev.out).toContain('1 movidos')
  expect(categoriaDe('Ceviche de Cochino')).toBe('Pescado y mar')
  expect(conteo.productos()).toBe(menu.productos.length)
  expect(conteo.grupos()).toBe(N_GRUPOS)
})

test('--revertir deshace cada corrida: primero la de la opción suelta, luego la importación completa', () => {
  expect(respaldos.length).toBeGreaterThanOrEqual(3)
  const primera = respaldos[0]
  const opcionSuelta = respaldos[1]
  const r1 = importar(`--revertir=${path.relative(ROOT, opcionSuelta)}`)
  expect(r1.code, r1.out).toBe(0)
  expect(conteo.opciones()).toBe(N_OPCIONES - 1) // se fue solo la opción que esa corrida creó
  expect(conteo.grupos()).toBe(N_GRUPOS)

  const r2 = importar(`--revertir=${path.relative(ROOT, primera)}`)
  expect(r2.code, r2.out).toBe(0)
  expect(r2.out).toContain(`${N_GRUPOS} grupos`)
  expect(conteo.grupos()).toBe(0)
  expect(conteo.opciones()).toBe(0)
  expect(conteo.productos()).toBe(0)
  expect(conteo.categorias()).toBe(0)
})
