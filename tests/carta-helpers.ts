import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { expect, type BrowserContext, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import { sql } from './alta-helpers'

/**
 * Ayudas de la suite E2E de la Carta (SPEC_Plantilla_Carta.md §10, §12, §13). Escrita ANTES del código: los
 * data-testid están publicados en .doc/carta/TESTIDS.md y son el contrato con CLI-B.
 *
 * Datos: CafeConBike_menu_normalizado.xlsx (38 platos, 10 categorías, 14 tamaños). Se siembran en un negocio ZZ propio
 * (nunca en un tenant real) y se borran al terminar. Servidor local: E2E_BASE_URL (por defecto el puerto 3101).
 */
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3101'
export const SLUG = 'zz-carta-e2e'
export const SLUG_SOLO_BS = 'zz-carta-solo-bs'
export const WHATSAPP = '584141234567'
export const CEDULA = 'V12345678'

const XLSX_PATH = process.env.CARTA_XLSX ?? 'C:/laragon/www/activopos/.doc/cafeconbike/CafeConBike_menu_normalizado.xlsx'

export interface Plato { id: number; categoria: string; nombre: string; descripcion: string; precio: number; tamanos: boolean; destacado: boolean; etiquetas: string; nota: string; foto: string }
export interface Tamano { producto: string; tamano: string; precio: number }

function filas(hoja: string): unknown[][] {
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' })
  return (XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1 }) as unknown[][]).slice(1).filter(r => r.length > 0)
}

export const PLATOS: Plato[] = filas('Productos').map(r => ({
  id: Number(r[0]), categoria: String(r[1]), nombre: String(r[2]), descripcion: String(r[3] ?? ''), precio: Number(r[4]),
  tamanos: r[5] === 'sí', destacado: r[6] === 'sí', etiquetas: String(r[7] ?? ''), nota: String(r[8] ?? ''), foto: String(r[9] ?? ''),
}))
export const TAMANOS: Tamano[] = filas('Tamaños').map(r => ({ producto: String(r[1]), tamano: String(r[2]), precio: Number(r[3]) }))
export const CATEGORIAS: string[] = filas('Categorias').map(r => String(r[1]))

export const plato = (nombre: string): Plato => {
  const p = PLATOS.find(x => x.nombre === nombre)
  if (!p) throw new Error(`plato ${nombre} no está en el xlsx`)
  return p
}
export const tamanosDe = (nombre: string): Tamano[] => TAMANOS.filter(t => t.producto === nombre)

/** Slug de categoría que usa la Carta en data-testid (contrato: minúsculas, sin acentos, guiones). */
export const slugCategoria = (c: string): string => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Búsqueda híbrida del proyecto: AND entre palabras, OR entre campos (nombre, descripción, nota, etiquetas). Oráculo independiente de la app. */
export function platosQueCoinciden(consulta: string): Plato[] {
  const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean)
  return PLATOS.filter(p => {
    const campos = [p.nombre, p.descripcion, p.nota, p.etiquetas].map(sinAcentos)
    return palabras.every(w => campos.some(c => c.includes(w)))
  })
}

export const usd = (n: number): string => `$${n.toFixed(2)}`
export const bs = (n: number): string => `Bs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const redondeo = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Tasa BCV vigente tal como la lee el servidor (última fila activa de dollar_rates, fuente bcv). */
export function tasaBcv(): number {
  const t = Number(sql("SELECT rate FROM dollar_rates WHERE source='bcv' AND is_active=1 ORDER BY id DESC LIMIT 1"))
  if (!(t > 0)) throw new Error('no hay tasa BCV activa en dollar_rates')
  return t
}

type Dias = Record<string, string[][]>
const SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
const horarioTodoElDia = (): Dias => Object.fromEntries(SEMANA.map(d => [d, [['00:00', '23:59']]]))
const horarioCerrado = (): Dias => Object.fromEntries(SEMANA.map(d => [d, []]))

export interface SiembraOpciones { slug: string; soloBs?: boolean; abierto?: boolean; style?: 'casual' | 'fine' }

const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`

/** Borra el negocio ZZ de la Carta con todo lo que cuelga de él. Idempotente. */
export function limpiarCarta(slug: string): void {
  const id = sql(`SELECT id FROM businesses WHERE catalog_slug=${q(slug)}`)
  if (!id) return
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id=${id})`)
  sql(`DELETE FROM orders WHERE business_id=${id}`)
  sql(`DELETE FROM clients WHERE business_id=${id}`)
  sql(`DELETE FROM inventory_entries WHERE business_id=${id}`)
  sql(`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE business_id=${id})`)
  sql(`DELETE FROM products WHERE business_id=${id}`)
  sql(`DELETE FROM categories WHERE business_id=${id}`)
  sql(`DELETE FROM payment_methods WHERE business_id=${id}`)
  sql(`DELETE FROM users WHERE business_id=${id}`)
  sql(`DELETE FROM businesses WHERE id=${id}`)
}

/**
 * Siembra el menú de CafeConBike en un negocio ZZ con catalog_template='carta'. Devuelve el id del negocio.
 * Divisa: solo "Pechuga de Pollo Asada" tiene precio Divisa (regla 0 < divisa < lista) para probar §13.3 sin tocar el resto.
 */
export function sembrarCarta(o: SiembraOpciones): number {
  limpiarCarta(o.slug)
  const settings = { carta_hours: o.abierto === false ? horarioCerrado() : horarioTodoElDia(), carta_paused: false, carta_style: o.style ?? 'casual' }
  sql(`INSERT INTO businesses (name, updated_at, catalog_slug, catalog_active, catalog_template, catalog_title, whatsapp, settings, segment, catalog_plan, subscription_active, catalog_cover_path) VALUES (${q('ZZ Carta E2E')}, NOW(3), ${q(o.slug)}, 1, 'carta', ${q('Café con Bike')}, ${q(WHATSAPP)}, ${q(JSON.stringify(settings))}, 'restaurante', 'negocio_activo', 1, '/brand/cashea.png')`)
  const bid = Number(sql(`SELECT id FROM businesses WHERE catalog_slug=${q(o.slug)}`))
  // El pedido atribuye las reservas al admin del negocio; los platos simples necesitan existencias (inventory_entries).
  sql(`INSERT INTO users (business_id, name, email, role, is_active, password, updated_at) VALUES (${bid}, 'ZZ Admin Carta', 'zz-admin-${bid}@zz-carta.invalid', 'admin', 1, 'x', NOW(3))`)
  CATEGORIAS.forEach((c, i) => sql(`INSERT INTO categories (business_id, name, sort_order) VALUES (${bid}, ${q(c)}, ${i})`))
  const metodos = o.soloBs ? [['Pago móvil', 'transfer', 0]] : [['Zelle', 'zelle', 0], ['Pago móvil', 'transfer', 0], ['Cashea', 'other', 1]]
  metodos.forEach(([n, t, f], i) => sql(`INSERT INTO payment_methods (business_id, name, type, is_financing, sort_order, is_active) VALUES (${bid}, ${q(String(n))}, ${q(String(t))}, ${f}, ${i}, 1)`))
  if (!o.soloBs) sql(`UPDATE businesses SET settings=JSON_SET(settings, '$.catalog_divisa_methods', JSON_ARRAY((SELECT id FROM payment_methods WHERE business_id=${bid} AND name='Zelle'))) WHERE id=${bid}`)
  PLATOS.forEach((p, i) => {
    const etiquetas = p.etiquetas.includes('nuevo') ? 'new' : 'none'
    const divisa = !o.soloBs && p.nombre === 'Pechuga de Pollo Asada' ? 12 : 'NULL'
    const cashea = !o.soloBs ? 1 : 0
    const base = p.tamanos ? Math.min(...tamanosDe(p.nombre).map(t => t.precio), p.precio) : p.precio
    sql(`INSERT INTO products (business_id, name, updated_at, description, price_per_unit_usd, precio_divisa, wholesale_price_usd, category_id, show_in_catalog, is_featured, badge, has_variants, sort_order, financing_eligible, notes, images)
         VALUES (${bid}, ${q(p.nombre)}, NOW(3), ${q(p.descripcion)}, ${base}, ${divisa}, ${divisa}, (SELECT id FROM categories WHERE business_id=${bid} AND name=${q(p.categoria)}), 1, ${p.destacado ? 1 : 0}, ${q(etiquetas)}, ${p.tamanos ? 1 : 0}, ${i}, ${cashea}, ${q(p.nota)}, ${p.foto ? q(JSON.stringify([p.foto])) : 'NULL'})`)
    if (!p.tamanos) {
      sql(`INSERT INTO inventory_entries (business_id, product_id, quantity, entry_type, notes, created_by, created_at) VALUES (${bid}, (SELECT id FROM products WHERE business_id=${bid} AND name=${q(p.nombre)}), 999, 'adjustment', 'ZZ seed', (SELECT id FROM users WHERE business_id=${bid} LIMIT 1), NOW(3))`)
      return
    }
    tamanosDe(p.nombre).forEach((t, j) => {
      sql(`INSERT INTO product_variants (product_id, tipo, valor, variant_group, price_usd, stock, sort_order, is_active) VALUES ((SELECT id FROM products WHERE business_id=${bid} AND name=${q(p.nombre)}), 'tamano', ${q(t.tamano)}, 'tamano', ${t.precio}, 999, ${j}, 1)`)
    })
  })
  return bid
}

export function ajustarSettings(slug: string, parche: Record<string, unknown>): void {
  sql(`UPDATE businesses SET settings=JSON_MERGE_PATCH(COALESCE(settings,'{}'), ${q(JSON.stringify(parche))}) WHERE catalog_slug=${q(slug)}`)
}

export const urlCarta = (slug: string = SLUG): string => `/catalogo-carta/${slug}`

/** Captura los enlaces de WhatsApp que abre la app (window.open o navegación) sin salir a internet. */
export function capturarWhatsApp(context: BrowserContext): string[] {
  const urls: string[] = []
  void context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, route => { urls.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }) })
  return urls
}

/** Texto del mensaje (parámetro text= de wa.me) ya decodificado, con saltos de línea \n. */
export function textoDeWhatsApp(url: string): string {
  return (new URL(url).searchParams.get('text') ?? '').replace(/\r\n/g, '\n')
}

/** Mensaje que la Carta debe enviar (contrato C1, ver TESTIDS.md §Mensaje). Un solo lugar: si el formato cambia, cambia aquí. */
export interface LineaMensaje { cantidad: number; nombre: string; detalle?: string; subtotal: number; nota?: string }
export function mensajeEsperado(a: { numero: string; negocio: string; modalidad: string; cliente: string; telefono: string; pago: string; lineas: LineaMensaje[]; tasa: number }): string {
  const total = redondeo(a.lineas.reduce((s, l) => s + l.subtotal, 0))
  const lineas = a.lineas.flatMap(l => [
    `${l.cantidad}x ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''} — ${usd(l.subtotal)}`,
    ...(l.nota ? [`   Nota: ${l.nota}`] : []),
  ])
  return [
    `*Pedido ${a.numero} · ${a.negocio}*`,
    `Modalidad: ${a.modalidad}`,
    `Cliente: ${a.cliente} · ${a.telefono}`,
    `Pago: ${a.pago}`,
    '',
    ...lineas,
    '',
    `Total: ${usd(total)} · ${bs(redondeo(total * a.tasa))}`,
  ].join('\n')
}

/** Sin scroll horizontal en la página (A8). */
export async function sinScrollHorizontal(page: Page): Promise<void> {
  const sobrante = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(sobrante, 'la página no debe desbordar en horizontal').toBeLessThanOrEqual(0)
}

/** Ejecuta axe-core (ya instalado en node_modules) y devuelve las violaciones serias/críticas. */
export async function violacionesAxe(page: Page): Promise<string[]> {
  const dir = mkdtempSync(path.join(tmpdir(), 'axe-'))
  try {
    writeFileSync(path.join(dir, 'axe.js'), readFileSync(require.resolve('axe-core/axe.min.js')))
    await page.addScriptTag({ path: path.join(dir, 'axe.js') })
    const res = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (c?: unknown, o?: unknown) => Promise<{ violations: { id: string; impact: string | null; nodes: unknown[] }[] }> } }).axe
      return (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length }))
    })
    return res.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id} (${v.impact}, ${v.n})`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
