import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Configuración › Cobro y precios. Negocio de prueba propio (premium mientras dura la prueba), medios y productos ZZ propios.
 * Al final se restauran EXACTAMENTE settings y catalog_template, y se borran los datos ZZ y los registros de auditoría.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const OWN = ownBusiness() // negocio de prueba propio (E2E_BUSINESS_ID); el 80 es el valor por defecto si no existe
const BID = OWN.businessId
const SLUG = OWN.slug
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
let abriCaja = false

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
  const drafts = sql(`SELECT id FROM sales WHERE business_id=${BID} AND status='draft' AND id>${baseSaleId} AND cashier_id=${OWN.adminId}`).split('\n').filter(Boolean).join(',')
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
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(OWN.adminId, 'admin')}` } })
  // el POS pide caja abierta; en el negocio propio se abre aquí y se cierra al final
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
    const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  const p = await api.post('/api/products', { data: { name: PROD, cost_per_unit_usd: 5, price_per_unit_usd: 40, wholesale_price_usd: 30, is_fixed_price: true, stock_quantity: 10, catalog_visibility: 'visible' } })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
  // estado ON completo: premium + Divisa + Cashea + método Divisa
  expect(await patch({ template: 'premium', divisa_enabled: true, cashea_enabled: true, collect_in: 'both', divisa_method_ids: [divisaMethodId] })).toBe(200)
})

test.afterAll(async () => {
  if (abriCaja && api) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZA prueba cobro-precios' } })
  await api?.dispose()
  restaurar()
  if (origSettings === '') sql(`UPDATE businesses SET settings=NULL, catalog_template='${origTemplate}' WHERE id=${BID}`)
  else sql(`UPDATE businesses SET settings='${esc(origSettings)}', catalog_template='${origTemplate}' WHERE id=${BID}`)
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Cobro Prod%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZ Cobro %'`))).toBe(0)
})

async function loginPos(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(OWN.adminId, 'admin'), url: BASE }])
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
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toBeVisible({ timeout: 60_000 }) // 1.ª carga en frío del POS en next dev
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
  await expect(page.getByRole('button', { name: 'Nuevo ticket' })).toBeVisible({ timeout: 60_000 })
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
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toBeVisible({ timeout: 60_000 }) // 1.ª carga en frío del POS en next dev
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
  await expect(tab.getByTestId('cp-template-carta')).toBeEnabled()
  await expect(tab.getByTestId('cp-template-carta')).toContainText('Carta')
  await page.screenshot({ path: 'tests/__capturas__/cobro-panel-1280.png' })

  await tab.getByTestId('cp-divisa').click()
  await expect(tab.getByTestId('cp-preview')).not.toContainText('Selector Divisa / Bs')
  await tab.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect.poll(() => sql(`SELECT JSON_EXTRACT(settings,'$.cobro_precios.divisa_enabled') FROM businesses WHERE id=${BID}`)).toBe('false')

  const log = sql(`SELECT CONCAT(user_id,'|',action,'|',IF(created_at IS NULL,'sin fecha','con fecha')) FROM activity_logs WHERE business_id=${BID} AND action='cobro_precios_updated' AND id>${baseLogId} ORDER BY id DESC LIMIT 1`)
  expect(log).toBe(`${OWN.adminId}|cobro_precios_updated|con fecha`)

  await page.setViewportSize({ width: 375, height: 800 })
  await page.reload()
  await page.getByRole('button', { name: 'Cobro y precios' }).click()
  await expect(page.getByTestId('tab-cobro-precios')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'tests/__capturas__/cobro-panel-375.png', fullPage: true })
})

test('OnBike real (negocio 33): settings.financing ausente + catalog_financing_badge="cashea" → panel Cashea ON; guardar sin tocar deja badge y logos intactos', async ({ page }) => {
  // Estado EXACTO de producción: sin settings.financing y solo el sello legacy.
  sql(`UPDATE businesses SET settings=JSON_OBJECT('catalog_financing_badge','cashea'), catalog_template='premium' WHERE id=${BID}`)
  expect(sql(`SELECT JSON_EXTRACT(settings,'$.financing') IS NULL FROM businesses WHERE id=${BID}`)).toBe('1')

  // API: el panel lee Cashea ON (legacy) y no hay claves nuevas
  const g = (await (await api.get('/api/config/cobro-precios')).json()) as { config: { cashea_enabled: boolean }; effective: { casheaActive: boolean }; financing: { enabled: boolean } }
  expect(g.config.cashea_enabled).toBe(true)
  expect(g.effective.casheaActive).toBe(true)
  expect(g.financing.enabled).toBe(true)

  // pantalla: Cashea ON y "Guardar cambios" deshabilitado (no se tocó nada)
  await loginPos(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Cobro y precios' }).click()
  const tab = page.getByTestId('tab-cobro-precios')
  await expect(tab.getByTestId('cp-cashea')).toHaveAttribute('aria-checked', 'true')
  await expect(tab.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()

  const badge = () => sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.catalog_financing_badge')) FROM businesses WHERE id=${BID}`)
  const logos = async () => { await page.goto(fichaUrl()); await expect(page.getByTestId('precio-divisa')).toBeVisible(); return page.locator('img[src*="cashea"]').count() }
  expect(await logos()).toBeGreaterThan(0)

  // "guardar" un cambio ajeno a Cashea (valor igual al actual): no materializa financing ni toca el sello
  expect(await patch({ divisa_enabled: true })).toBe(200)
  expect(badge()).toBe('cashea')
  expect(sql(`SELECT JSON_EXTRACT(settings,'$.financing') IS NULL FROM businesses WHERE id=${BID}`)).toBe('1')
  expect(await logos()).toBeGreaterThan(0)

  // guardar Cashea ON explícito: sigue ON, sello intacto, logos intactos
  expect(await patch({ cashea_enabled: true })).toBe(200)
  expect(badge()).toBe('cashea')
  expect(sql(`SELECT JSON_EXTRACT(settings,'$.financing.enabled') FROM businesses WHERE id=${BID}`)).toBe('true')
  expect(await logos()).toBeGreaterThan(0)
})
