import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Configuración › Cobro y precios. Negocio 80 (premium mientras dura la prueba), medios y productos ZZ propios.
 * Al final se restauran EXACTAMENTE settings y catalog_template, y se borran los datos ZZ y los registros de auditoría.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const SLUG = 'boutique-demo'
const TAG = String(Date.now()).slice(-6)
const PROD = `ZZ Cobro Prod ${TAG}`
const M_DIV = `ZZ Cobro Binance ${TAG}`
const M_CAS = `ZZ Cobro Cashea ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let productId = 0
let divisaMethodId = 0
let origSettings = ''
let origTemplate = 'generic'
let baseLogId = 0
let baseSaleId = 0

const tokenFor = (userId: number, role: string) => new SignJWT({ userId, businessId: BID, role, name: 'Prueba' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "''")

async function patch(data: Record<string, unknown>): Promise<number> {
  return (await api.patch('/api/config/cobro-precios', { data })).status()
}

function restaurar(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Cobro Prod%'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZ Cobro %'`)
  sql(`DELETE FROM activity_logs WHERE business_id=${BID} AND action='cobro_precios_updated' AND id>${baseLogId}`)
  const drafts = sql(`SELECT id FROM sales WHERE business_id=${BID} AND status='draft' AND id>${baseSaleId} AND cashier_id=79`).split('\n').filter(Boolean).join(',')
  if (drafts) {
    sql(`DELETE FROM sale_items WHERE sale_id IN (${drafts})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND status='draft' AND id IN (${drafts})`)
  }
}

test.beforeAll(async () => {
  origSettings = sql(`SELECT IFNULL(settings,'') FROM businesses WHERE id=${BID}`)
  origTemplate = sql(`SELECT IFNULL(catalog_template,'generic') FROM businesses WHERE id=${BID}`)
  baseLogId = Number(sql('SELECT COALESCE(MAX(id),0) FROM activity_logs'))
  baseSaleId = Number(sql('SELECT COALESCE(MAX(id),0) FROM sales'))
  restaurar()
  sql(`INSERT INTO payment_methods (business_id,name,type,is_financing,is_active) VALUES (${BID},'${M_DIV}','binance',0,1),(${BID},'${M_CAS}','other',1,1)`)
  divisaMethodId = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='${M_DIV}'`))
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(79, 'admin')}` } })
  const p = await api.post('/api/products', { data: { name: PROD, cost_per_unit_usd: 5, price_per_unit_usd: 40, wholesale_price_usd: 30, is_fixed_price: true, stock_quantity: 10, catalog_visibility: 'visible' } })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
  // estado ON completo: premium + Divisa + Cashea + método Divisa
  expect(await patch({ template: 'premium', divisa_enabled: true, cashea_enabled: true, collect_in: 'both', divisa_method_ids: [divisaMethodId] })).toBe(200)
})

test.afterAll(async () => {
  await api?.dispose()
  restaurar()
  if (origSettings === '') sql(`UPDATE businesses SET settings=NULL, catalog_template='${origTemplate}' WHERE id=${BID}`)
  else sql(`UPDATE businesses SET settings='${esc(origSettings)}', catalog_template='${origTemplate}' WHERE id=${BID}`)
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Cobro Prod%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZ Cobro %'`))).toBe(0)
})

async function loginPos(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(79, 'admin'), url: BASE }])
}

const fichaUrl = () => `/catalogo-premium/${SLUG}/p/${productId}`

test('API: sin sesión 401, cajero 403, clave desconocida 400, método ajeno 422', async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE })
  expect((await anon.get('/api/config/cobro-precios', { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300) // el middleware redirige o responde 401
  await anon.dispose()

  const cashierId = Number(sql(`SELECT id FROM users WHERE business_id=${BID} AND role='cashier' LIMIT 1`) || '0')
  if (cashierId > 0) {
    const c = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(cashierId, 'cashier')}` } })
    expect((await c.patch('/api/config/cobro-precios', { data: { divisa_enabled: false }, maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300)
    await c.dispose()
  }

  expect(await patch({ business_id: 1 })).toBe(400)           // zod estricto: el business_id nunca viene del body
  expect(await patch({ collect_in: 'euros' })).toBe(400)
  expect(await patch({})).toBe(400)
  const ajeno = Number(sql(`SELECT id FROM payment_methods WHERE business_id<>${BID} LIMIT 1`) || '0')
  if (ajeno > 0) expect(await patch({ divisa_method_ids: [ajeno] })).toBe(422)
})

test('ON: ficha con selector + Cashea, tarjeta con Cashea, POS con selector y financiadora', async ({ page }) => {
  await page.goto(fichaUrl())
  const bloque = page.getByTestId('precio-divisa')
  await expect(bloque.getByRole('radio')).toHaveCount(2)
  await expect(bloque.getByRole('radio', { name: /Bolívares/ }).locator('img[src*="cashea"]')).toHaveCount(1)
  await expect(bloque.getByRole('list', { name: 'Formas de pago en divisa' })).toContainText(M_DIV)

  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  await expect(page.locator('[data-testid="precio-cashea"] img[src*="cashea"]').first()).toBeVisible()

  await loginPos(page)
  const methods = await api.get('/api/payment-methods')
  const names = ((await methods.json()) as { methods: Array<{ name: string }> }).methods.map(m => m.name)
  expect(names).toContain(M_CAS)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pos')
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toBeVisible()
})

test('OFF (Divisa OFF + Cashea OFF + cobro solo Bs): sin selector, sin Cashea, $ con Bs debajo; el servidor rechaza el modo Divisa', async ({ page }) => {
  expect(await patch({ divisa_enabled: false, cashea_enabled: false, collect_in: 'bs' })).toBe(200)

  // ficha: una sola opción, precio $ (el normal) con el Bs debajo, sin Cashea
  await page.goto(fichaUrl())
  await expect(page.getByRole('heading', { name: PROD })).toBeVisible()
  await expect(page.getByTestId('precio-divisa')).toHaveCount(0)
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.locator('img[src*="cashea"]')).toHaveCount(0)
  await expect(page.getByText(/MEJOR PRECIO/)).toHaveCount(0)
  await expect(page.getByText('$40.00').first()).toBeVisible()
  await expect(page.getByText(/Bs\.\s*[\d.,]+/).first()).toBeVisible()
  await page.screenshot({ path: 'tests/__capturas__/cobro-ficha-off-1280.png' })

  // tarjeta: sin Cashea, $ con Bs debajo
  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  await expect(page.locator('[data-testid="precio-principal"]').filter({ hasText: '40.00' }).first()).toBeVisible()
  await expect(page.locator('[data-testid="precio-cashea"]').first()).toContainText('Bs')
  await expect(page.locator('img[src*="cashea"]')).toHaveCount(0)

  // POS: sin selector BCV/Divisa y sin financiadora; el servidor rechaza Divisa (409)
  await loginPos(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pos')
  await expect(page.getByRole('button', { name: 'Nuevo ticket' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toHaveCount(0)
  const methods = await api.get('/api/payment-methods')
  expect(((await methods.json()) as { methods: Array<{ name: string }> }).methods.map(m => m.name)).not.toContain(M_CAS)

  const draft = await api.post('/api/pos/drafts', { data: { items: [] } })
  expect(draft.status(), await draft.text()).toBeLessThan(300)
  const body = (await draft.json()) as { draft?: { id: number }; id?: number }
  const draftId = body.draft?.id ?? body.id
  expect(draftId).toBeTruthy()
  const rejected = await api.patch(`/api/sales/${draftId}/price-mode`, { data: { price_mode: 'divisa' } })
  expect(rejected.status()).toBe(409)
  expect(((await rejected.json()) as { error: string }).error).toContain('desactivado')
  expect((await api.patch(`/api/sales/${draftId}/price-mode`, { data: { price_mode: 'bcv' } })).status()).toBeLessThan(300)
})

test('volver a ON restaura todo', async ({ page }) => {
  expect(await patch({ divisa_enabled: true, cashea_enabled: true, collect_in: 'both' })).toBe(200)
  await page.goto(fichaUrl())
  await expect(page.getByTestId('precio-divisa').getByRole('radio')).toHaveCount(2)
  await expect(page.locator('img[src*="cashea"]').first()).toBeVisible()
  await loginPos(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pos')
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toBeVisible()
  const methods = await api.get('/api/payment-methods')
  expect(((await methods.json()) as { methods: Array<{ name: string }> }).methods.map(m => m.name)).toContain(M_CAS)
})

test('"Cobras en: solo $": sin Cashea ni formas de pago en Bs, con Divisa', async ({ page }) => {
  expect(await patch({ collect_in: 'usd' })).toBe(200)
  await page.goto(fichaUrl())
  const bloque = page.getByTestId('precio-divisa')
  await expect(bloque.getByRole('radio')).toHaveCount(2)
  await expect(page.locator('img[src*="cashea"]')).toHaveCount(0)
  await bloque.getByRole('radio', { name: /Bolívares/ }).click()
  await expect(bloque.getByRole('list', { name: 'Formas de pago en bolívares' }).getByRole('listitem')).toHaveCount(0)
  expect(await patch({ collect_in: 'both' })).toBe(200)
})

test('pantalla: pestaña Cobro y precios, vista previa, guardar y auditoría (quién y cuándo)', async ({ page }) => {
  await loginPos(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Cobro y precios' }).click()
  const tab = page.getByTestId('tab-cobro-precios')
  await expect(tab).toBeVisible()
  await expect(tab.getByTestId('cp-preview')).toContainText('Vista previa')
  await expect(tab.getByTestId('cp-template-carta')).toBeDisabled()
  await expect(tab.getByTestId('cp-template-carta')).toContainText('Próximamente')
  await page.screenshot({ path: 'tests/__capturas__/cobro-panel-1280.png' })

  await tab.getByTestId('cp-divisa').click()
  await expect(tab.getByTestId('cp-preview')).not.toContainText('Selector Divisa / Bs')
  await tab.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect.poll(() => sql(`SELECT JSON_EXTRACT(settings,'$.cobro_precios.divisa_enabled') FROM businesses WHERE id=${BID}`)).toBe('false')

  const log = sql(`SELECT CONCAT(user_id,'|',action,'|',IF(created_at IS NULL,'sin fecha','con fecha')) FROM activity_logs WHERE business_id=${BID} AND action='cobro_precios_updated' AND id>${baseLogId} ORDER BY id DESC LIMIT 1`)
  expect(log).toBe('79|cobro_precios_updated|con fecha')

  await page.setViewportSize({ width: 375, height: 800 })
  await page.reload()
  await page.getByRole('button', { name: 'Cobro y precios' }).click()
  await expect(page.getByTestId('tab-cobro-precios')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'tests/__capturas__/cobro-panel-375.png', fullPage: true })
})
