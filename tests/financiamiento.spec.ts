import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, SLUG, apiAs, cleanupTestProducts } from './p0-helpers'

/**
 * T3 financiamiento (negocio 87): config por negocio (cashea / other / own), logo subido, elegibilidad
 * efectiva = activado en Configuración Y producto no excluido. Restaura settings.financing al final.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

interface PublicProduct { id: number; financing_available: boolean }
interface PublicCatalog { business: { financing: { mode: string; name: string | null; phrase: string; logo_url: string | null } | null }; products: PublicProduct[] }

let pid = 0

function resetSettings(): void {
  sql(`UPDATE businesses SET settings = JSON_REMOVE(JSON_REMOVE(IFNULL(settings, JSON_OBJECT()), '$.financing'), '$.catalog_financing_badge') WHERE id = ${BUSINESS_ID}`)
}

async function catalog(): Promise<PublicCatalog> {
  const api = await apiAs(null)
  const j = await (await api.get(`/api/catalog/${SLUG}`)).json() as PublicCatalog
  await api.dispose()
  return j
}

/** El catálogo público se cachea hasta 60 s; el PATCH revalida, pero se espera por si acaso. */
async function catalogWhen(check: (c: PublicCatalog) => boolean): Promise<PublicCatalog> {
  let last = await catalog()
  for (let i = 0; i < 10 && !check(last); i++) { await new Promise(r => setTimeout(r, 1000)); last = await catalog() }
  return last
}

test.beforeAll(async () => {
  cleanupTestProducts('Financ')
  resetSettings()
  const api = await apiAs()
  const r = await api.post('/api/products', { data: { name: 'ZZ Financ Producto', cost_per_unit_usd: 10, price_per_unit_usd: 30, stock_quantity: 5, show_in_catalog: true, catalog_visibility: 'visible', is_available: true } })
  expect(r.status()).toBe(201)
  pid = (await r.json()).product.id as number
  await api.dispose()
})
test.afterAll(() => { cleanupTestProducts('Financ'); resetSettings() })

test('por defecto: financiamiento desactivado, ningún producto elegible y financing_excluded=false', async () => {
  const api = await apiAs()
  const cfg = await (await api.get('/api/config/catalog')).json()
  expect(cfg.catalog.financing).toMatchObject({ enabled: false })
  expect(sql(`SELECT financing_excluded FROM products WHERE id=${pid}`)).toBe('0')
  const c = await catalogWhen(x => x.business.financing === null)
  expect(c.business.financing).toBeNull()
  expect(c.products.find(p => p.id === pid)?.financing_available).toBe(false)
  await api.dispose()
})

test('Cashea (preset): activar hace elegibles a todos; excluir un producto lo saca; frase editable', async () => {
  const api = await apiAs()
  const p = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'cashea', phrase: 'Cuotas con Cashea ya' } } })
  expect(p.status()).toBe(200)
  let c = await catalogWhen(x => x.business.financing !== null)
  expect(c.business.financing).toMatchObject({ mode: 'cashea', name: 'Cashea', phrase: 'Cuotas con Cashea ya', logo_url: '/brand/cashea.png' })
  expect(c.products.find(x => x.id === pid)?.financing_available).toBe(true)

  expect((await api.patch(`/api/products/${pid}`, { data: { financing_excluded: true } })).status()).toBe(200)
  c = await catalogWhen(x => x.products.find(y => y.id === pid)?.financing_available === false)
  expect(c.products.find(x => x.id === pid)?.financing_available).toBe(false)

  expect((await api.patch(`/api/products/${pid}`, { data: { financing_excluded: false } })).status()).toBe(200)
  await api.dispose()
})

test('Otra empresa: nombre obligatorio, logo externo y de otro tenant se rechazan con 422 + field', async () => {
  const api = await apiAs()
  const sinNombre = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'other' } } })
  expect(sinNombre.status()).toBe(422)
  expect(await sinNombre.json()).toMatchObject({ field: 'provider_name' })

  const externo = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'other', provider_name: 'Krece', logo_url: 'https://evil.example/x.png' } } })
  expect(externo.status()).toBe(422)
  expect(await externo.json()).toMatchObject({ field: 'logo_url' })

  const ajeno = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'other', provider_name: 'Krece', logo_url: '/storage/tenants/33/financing/00000000-0000-0000-0000-000000000000.webp' } } })
  expect(ajeno.status()).toBe(422)
  await api.dispose()
})

test('Otra empresa con logo subido (type=financing) se guarda y llega al catálogo público', async () => {
  const api = await apiAs()
  const up = await api.post('/api/upload/image', {
    multipart: { type: 'financing', file: { name: 'logo.png', mimeType: 'image/png', buffer: readFileSync(join(process.cwd(), 'public', 'brand', 'cashea.png')) } },
  })
  expect(up.status()).toBe(201)
  const { url } = await up.json() as { url: string }
  expect(url).toMatch(new RegExp(`^/storage/tenants/${BUSINESS_ID}/financing/`))

  const p = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'other', provider_name: 'Krece', logo_url: url } } })
  expect(p.status()).toBe(200)
  const c = await catalogWhen(x => x.business.financing?.mode === 'other')
  expect(c.business.financing).toMatchObject({ mode: 'other', name: 'Krece', phrase: 'Paga en cuotas con Krece', logo_url: url })
  await api.dispose()
})

test('Financiamiento propio: solo texto, la frase es obligatoria y no guarda logo', async () => {
  const api = await apiAs()
  const sinFrase = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'own' } } })
  expect(sinFrase.status()).toBe(422)
  expect(await sinFrase.json()).toMatchObject({ field: 'phrase' })

  const ok = await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'own', phrase: 'Financiamos tu compra en 3 cuotas', logo_url: '/brand/cashea.png' } } })
  expect(ok.status()).toBe(200)
  const c = await catalogWhen(x => x.business.financing?.mode === 'own')
  expect(c.business.financing).toEqual({ mode: 'own', name: null, phrase: 'Financiamos tu compra en 3 cuotas', logo_url: null })
  await api.dispose()
})

test('compatibilidad: interruptor viejo catalog_financing_badge=cashea activa el preset', async () => {
  resetSettings()
  const api = await apiAs()
  expect((await api.patch('/api/config/catalog', { data: { catalog_financing_badge: 'cashea' } })).status()).toBe(200)
  const cfg = await (await api.get('/api/config/catalog')).json()
  expect(cfg.catalog.financing).toMatchObject({ enabled: true, mode: 'cashea' })
  expect((await api.patch('/api/config/catalog', { data: { catalog_financing_badge: null } })).status()).toBe(200)
  expect((await (await api.get('/api/config/catalog')).json()).catalog.financing.enabled).toBe(false)
  await api.dispose()
})

test('ficha pública: sello Cashea con financiamiento activo, sin sello si el producto está excluido', async ({ page }) => {
  const api = await apiAs()
  await api.patch('/api/config/catalog', { data: { financing: { enabled: true, mode: 'cashea' } } })
  await page.goto(`/catalogo/${SLUG}/p/${pid}`)
  await expect(page.getByRole('heading', { name: 'ZZ Financ Producto' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('img[alt="Cashea"]')).toHaveCount(1) // FinancingNote pinta el logo con alt = nombre del proveedor

  await api.patch(`/api/products/${pid}`, { data: { financing_excluded: true } })
  await page.goto(`/catalogo/${SLUG}/p/${pid}`)
  await expect(page.getByRole('heading', { name: 'ZZ Financ Producto' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('img[alt="Cashea"]')).toHaveCount(0)
  await api.dispose()
})
