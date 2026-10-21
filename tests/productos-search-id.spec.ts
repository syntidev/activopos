import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, apiAs, cleanupTestProducts, tokenFor } from './p0-helpers'

/**
 * GET /api/products/search?id=12 | ?id=12,15,40 (máx. 50): hidratar borradores del POS por id exacto con rol CAJERO
 * (GET /api/products/[id] es solo admin). Mismo formato que el buscador, con variantes y precios BCV y Divisa.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

interface Hit { id: number; wholesale_price_usd: number | null; price_per_unit_usd: number | null; variants: Array<{ id: number; precio_extra: number; price_usd: number | null }>; stock: { net_qty: number } }

const CASHIER_ID = Number(sql(`SELECT id FROM users WHERE business_id=${BUSINESS_ID} AND role='cashier' ORDER BY id LIMIT 1`))
const ids = { a: 0, b: 0, ajeno: 0 }
let cajero: APIRequestContext

async function crear(api: APIRequestContext, data: Record<string, unknown>): Promise<number> {
  const r = await api.post('/api/products', { data })
  expect(r.status(), JSON.stringify(await r.json().catch(() => ({})))).toBe(201)
  return (await r.json()).product.id as number
}

test.beforeAll(async () => {
  cleanupTestProducts('Idsearch')
  const admin = await apiAs()
  ids.a = await crear(admin, { name: 'ZZ Idsearch A', cost_per_unit_usd: 5, price_per_unit_usd: 20, wholesale_price_usd: 16, stock_quantity: 4 })
  ids.b = await crear(admin, {
    name: 'ZZ Idsearch B', cost_per_unit_usd: 5, price_per_unit_usd: 30, has_variants: true,
    variants: [{ tipo: 'talla', valor: 'S', stock: 3, precio_extra: 2 }],
  })
  ids.ajeno = Number(sql(`SELECT id FROM products WHERE business_id<>${BUSINESS_ID} AND active=1 AND is_available=1 LIMIT 1`))
  await admin.dispose()
  cajero = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(CASHIER_ID, 'cashier')}` } })
})
test.afterAll(async () => { await cajero.dispose(); cleanupTestProducts('Idsearch') })

test('cajero: un id válido devuelve el producto con precios BCV y Divisa y stock', async () => {
  // GET /api/products/[id] sí es solo admin (esa es la razón de esta ruta)
  expect((await cajero.get(`/api/products/${ids.a}`)).status()).toBe(403)

  const r = await cajero.get(`/api/products/search?id=${ids.a}`)
  expect(r.status()).toBe(200)
  const j = await r.json() as { ok: boolean; products: Hit[]; rate: number }
  expect(j.ok).toBe(true)
  expect(j.products).toHaveLength(1)
  expect(j.products[0]).toMatchObject({ id: ids.a, price_per_unit_usd: 20, wholesale_price_usd: 16 })
  expect(j.products[0].stock.net_qty).toBe(4)
  expect(j.rate).toBeGreaterThan(0)
})

test('varios ids separados por coma: respeta el orden pedido, trae variantes y omite los repetidos', async () => {
  const j = await (await cajero.get(`/api/products/search?id=${ids.b},${ids.a},${ids.b}`)).json() as { products: Hit[] }
  expect(j.products.map(p => p.id)).toEqual([ids.b, ids.a])
  expect(j.products[0].variants).toHaveLength(1)
  expect(j.products[0].variants[0]).toMatchObject({ precio_extra: 2, price_usd: null })
})

test('id de OTRO negocio: lista vacía (nunca filtra datos ajenos)', async () => {
  test.skip(!ids.ajeno, 'no hay productos de otros negocios en la DB local')
  const j = await (await cajero.get(`/api/products/search?id=${ids.ajeno}`)).json() as { products: Hit[] }
  expect(j.products).toEqual([])
  const mezcla = await (await cajero.get(`/api/products/search?id=${ids.ajeno},${ids.a}`)).json() as { products: Hit[] }
  expect(mezcla.products.map(p => p.id)).toEqual([ids.a])
})

test('51 ids responde 400; 50 ids pasa; ids no numéricos o vacíos responden 400', async () => {
  const lista = (n: number): string => Array.from({ length: n }, (_, i) => ids.a + i).join(',')
  const r51 = await cajero.get(`/api/products/search?id=${lista(51)}`)
  expect(r51.status()).toBe(400)
  expect((await r51.json()).error).toMatch(/1 a 50 ids/)
  expect((await cajero.get(`/api/products/search?id=${lista(50)}`)).status()).toBe(200)
  expect((await cajero.get('/api/products/search?id=abc')).status()).toBe(400)
  expect((await cajero.get(`/api/products/search?id=${ids.a},`)).status()).toBe(400)
  expect((await cajero.get('/api/products/search?id=')).status()).toBe(400)
})

test('sin sesión no se puede (el middleware corta) y la búsqueda por texto sigue igual', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE })
  const r = await anon.get(`/api/products/search?id=${ids.a}`, { maxRedirects: 0 })
  expect([307, 401]).toContain(r.status())
  await anon.dispose()
  const j = await (await cajero.get('/api/products/search?q=ZZ%20Idsearch')).json() as { products: Hit[] }
  expect(j.products.map(p => p.id).sort()).toEqual([ids.a, ids.b].sort())
})
