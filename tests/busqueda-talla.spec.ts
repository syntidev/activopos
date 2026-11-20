import { test, expect, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Búsqueda por talla: se compara contra el VALOR de la variante como token exacto. Negocio de pruebas propio (ZZA).
 * Siembra por la API del panel: un zapato (US 9 · EU 42.5 / US 12.5 · EU 47) y un maillot (S / M / XL con XL en 0).
 * Correr con el dev server en :3001 → E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN, slug: SLUG } = ownBusiness()
// Solo letras: un número en el nombre ("45") haría coincidir el producto por nombre y falsearía los casos.
const TAG = String(Date.now()).slice(-6).replace(/\d/g, d => 'abcdefghij'[Number(d)])
const ZAPATO = `ZZ Tenis Ruta ${TAG}`
const MAILLOT = `ZZ Maillot Ruta ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const ids: Record<string, number> = {}
const rows: string[] = []

async function token(): Promise<string> {
  return new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

async function sembrar(request: APIRequestContext, name: string, variants: Array<{ valor: string; stock: number }>): Promise<number> {
  const res = await request.post('/api/products', {
    data: {
      name, sale_mode: 'unit', price_per_unit_usd: 50, has_variants: true, catalog_visibility: 'visible', show_in_catalog: true,
      variants: variants.map(v => ({ tipo: 'talla', valor: v.valor, precio_extra: 0, stock: v.stock })),
    },
  })
  expect(res.status(), await res.text()).toBeLessThan(300)
  return ((await res.json()) as { product: { id: number } }).product.id
}

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  ids.zapato = await sembrar(request, ZAPATO, [{ valor: 'US 9 · EU 42.5', stock: 3 }, { valor: 'US 12.5 · EU 47', stock: 2 }, { valor: 'US 11.5 · EU 45', stock: 1 }, { valor: 'US 13 · EU 46', stock: 0 }])
  ids.maillot = await sembrar(request, MAILLOT, [{ valor: 'S', stock: 4 }, { valor: 'M', stock: 4 }, { valor: 'XL', stock: 0 }])
  await request.dispose()
})

test.afterAll(() => {
  for (const id of Object.values(ids)) {
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM product_variants WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BID}`)
  }
  console.log(['consulta | contexto | esperado | obtenido', ...rows].join('\n'))
})

type Ctx = 'catalogo' | 'pos'
const casos: Array<[string, Ctx, string[]]> = [
  ['12,5', 'catalogo', ['zapato']],
  ['talla 12.5', 'catalogo', ['zapato']],
  ['EU 47', 'catalogo', ['zapato']],
  ['12', 'catalogo', []],
  ['EU 42', 'catalogo', []],
  ['talla M', 'catalogo', ['maillot']],
  ['XL', 'catalogo', []],
  ['XL', 'pos', ['maillot']],
  ['L', 'pos', []],
  ['tenis 9', 'catalogo', ['zapato']],
  // Talla EU (uso venezolano): número suelto 34-50 = EU, token exacto, con stock en el catálogo
  ['45', 'catalogo', ['zapato']],
  ['talla 47', 'catalogo', ['zapato']],
  ['46', 'catalogo', []],
  ['46', 'pos', ['zapato']],
  ['42', 'catalogo', []],
]

for (const [q, ctx, esperado] of casos) {
  test(`"${q}" en ${ctx} → ${esperado.join(',') || 'nada'}`, async ({ playwright }) => {
    const mios = new Map(Object.entries(ids).map(([k, v]) => [v, k]))
    const request = await playwright.request.newContext({
      baseURL: BASE,
      ...(ctx === 'pos' ? { extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } } : {}),
    })
    const r = ctx === 'catalogo'
      ? await request.get(`/api/catalog/${SLUG}/search?q=${encodeURIComponent(q)}`)
      : await request.get(`/api/products/search?q=${encodeURIComponent(q)}&limit=50`)
    expect(r.status()).toBe(200)
    const body = (await r.json()) as { results?: Array<{ id: number }>; products?: Array<{ id: number }> }
    const hit = (body.results ?? body.products ?? []).map(x => mios.get(x.id)).filter((x): x is string => !!x)
    await request.dispose()
    rows.push(`${q} | ${ctx} | ${esperado.join(',') || '0'} | ${hit.join(',') || '0'}`)
    expect(hit.sort()).toEqual([...esperado].sort())
  })
}
