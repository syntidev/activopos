import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Selector de moneda de la ficha premium (mockup C) + tarjeta. Negocio 80: se pone en plantilla premium y con medios
 * divisa (Efectivo USD 313, Zelle 315 + ZZ Binance y ZZ Bancamiga Cash) mientras dura la prueba; todo se restaura al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const SLUG = 'boutique-demo'
const TAG = String(Date.now()).slice(-6)
const CON = `ZZ Divisa Con ${TAG}`
const SIN = `ZZ Divisa Sin ${TAG}`
const MOCKUP = 'file:///C:/laragon/www/activopos/.doc/mockups/precio_divisa_opcionC_v2.html'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let idCon = 0
let idSin = 0
let templateOriginal = 'generic'

const token = () => new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function restaurar(): void {
  sql(`UPDATE businesses SET catalog_template='${templateOriginal}', settings=JSON_REMOVE(COALESCE(settings,JSON_OBJECT()),'$.catalog_divisa_methods') WHERE id=${BID}`)
  sql(`DELETE FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZ Divisa %'`)
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Divisa%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  templateOriginal = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) || 'generic'
  if (templateOriginal === 'premium') templateOriginal = 'generic'
  restaurar()
  sql(`INSERT INTO payment_methods (business_id,name,type,is_financing) VALUES (${BID},'ZZ Divisa Binance','binance',0),(${BID},'ZZ Divisa Bancamiga Cash','other',0),(${BID},'ZZ Divisa Transferencia','transfer',0),(${BID},'ZZ Divisa Cashea','other',1)`)
  const idsZz = sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name IN ('ZZ Divisa Binance','ZZ Divisa Bancamiga Cash')`).split('\n').filter(Boolean)
  sql(`UPDATE businesses SET catalog_template='premium', settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.catalog_divisa_methods',JSON_ARRAY(313,315,${idsZz.join(',')})) WHERE id=${BID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const mk = async (data: Record<string, unknown>): Promise<number> => {
    const r = await api.post('/api/products', { data: { is_fixed_price: true, cost_per_unit_usd: 5, stock_quantity: 10, catalog_visibility: 'visible', ...data } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idCon = await mk({ name: CON, price_per_unit_usd: 40, wholesale_price_usd: 30 })
  idSin = await mk({ name: SIN, price_per_unit_usd: 20 })
})

test.afterAll(async () => {
  restaurar()
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Divisa%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${BID} AND name LIKE 'ZZ Divisa %'`))).toBe(0)
})

test('ficha con Divisa: radios abren en Divisa con badge y ahorro; Divisa→Bs cambia precio y chips', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${idCon}`)
  const bloque = page.getByTestId('precio-divisa')
  const grupo = bloque.getByRole('radiogroup', { name: '¿Cómo vas a pagar?' })
  await expect(grupo.getByRole('radio')).toHaveCount(2)
  const rDivisa = grupo.getByRole('radio', { name: /\$ Divisa/ })
  const rBs = grupo.getByRole('radio', { name: /Bolívares/ })
  await expect(rDivisa).toHaveAttribute('aria-checked', 'true')
  await expect(rBs).toHaveAttribute('aria-checked', 'false')
  // cada tarjeta muestra SU precio; badge solo en Divisa; ahorro frente al Full
  await expect(rDivisa).toContainText('$30.00')
  await expect(rBs).toContainText('$40.00')
  await expect(rDivisa).toContainText('MEJOR PRECIO')
  await expect(rBs).not.toContainText('MEJOR PRECIO')
  await expect(bloque.getByTestId('precio-principal')).toHaveText('$30.00')
  await expect(bloque).toContainText('Ahorras $10.00 frente al pago en bolívares')
  await expect(bloque).toContainText('Paga con')

  // grilla de dos columnas iguales
  const a = await rDivisa.boundingBox()
  const b = await rBs.boundingBox()
  expect(Math.abs((a?.width ?? 0) - (b?.width ?? 1))).toBeLessThan(2)
  expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2)

  // chips: solo lo que hay en la BD (settings + métodos activos); sin Pago Móvil ni Cashea en Divisa
  const divisa = bloque.getByRole('list', { name: 'Formas de pago en divisa' })
  for (const n of ['Binance', 'Zelle', 'Efectivo USD', 'Bancamiga Cash']) await expect(divisa).toContainText(n)
  await expect(divisa).not.toContainText('Pago Móvil')
  await expect(divisa).not.toContainText('Cashea')
  await page.screenshot({ path: 'tests/__capturas__/selector-ficha-1280-divisa.png' })

  await rBs.click()
  await expect(rBs).toHaveAttribute('aria-checked', 'true')
  await expect(rDivisa).toHaveAttribute('aria-checked', 'false')
  await expect(bloque.getByTestId('precio-principal')).toContainText('Bs')
  await expect(bloque).toContainText('Equivale a $40.00')
  await expect(bloque).not.toContainText('Ahorras')
  const bs = bloque.getByRole('list', { name: 'Formas de pago en bolívares' })
  await expect(bs).toContainText('Pago Móvil')
  await expect(bs).toContainText('Transferencia')
  await expect(bs.locator('img[src*="cashea"]')).toHaveCount(1)
  await expect(bs).not.toContainText('Bancamiga')
  await expect(page.getByText('Recibimos bolívares a tasa BCV')).toHaveCount(0) // retoque: ya lo dice el selector
  await expect(rBs.locator('img[src*="cashea"]')).toHaveCount(1) // el logo de Cashea queda dentro de la opción Bs
  await page.screenshot({ path: 'tests/__capturas__/selector-ficha-1280-bs.png' })

  // teclado: flecha izquierda vuelve a Divisa
  await rBs.press('ArrowLeft')
  await expect(rDivisa).toHaveAttribute('aria-checked', 'true')

  // El default no se recuerda: al recargar vuelve a Divisa.
  await rBs.click()
  await page.reload()
  await expect(page.getByTestId('precio-divisa').getByRole('radio', { name: /\$ Divisa/ })).toHaveAttribute('aria-checked', 'true')
})

test('ficha sin Divisa: Full como principal, sin selector', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${idSin}`)
  await expect(page.getByRole('heading', { name: SIN })).toBeVisible()
  await expect(page.getByTestId('precio-divisa')).toHaveCount(0)
  await expect(page.getByText('$20.00').first()).toBeVisible()
})

test('tarjeta: Divisa grande y debajo [Bs] [cashea] $Full', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/productos`)
  const card = page.locator('a, article, div').filter({ hasText: CON }).filter({ has: page.locator('[class*="priceUsd"]') }).last()
  await expect(card.locator('[class*="priceUsd"]').first()).toContainText('30.00')
  const linea = card.locator('[class*="priceFullLine"]').first()
  await expect(linea).toContainText('Bs')
  await expect(linea).toContainText('$40.00')
  await expect(linea.locator('img[alt="Cashea"]')).toHaveCount(1)
  await card.screenshot({ path: 'tests/__capturas__/selector-tarjeta-1280.png' })
})

test('375 px: sin scroll horizontal, orden foto > selector > precio y capturas de ambos modos', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/catalogo-premium/${SLUG}/p/${idCon}`)
  const bloque = page.getByTestId('precio-divisa')
  await expect(bloque).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const orden = await page.evaluate(() => {
    const y = (el: Element | null): number => (el ? el.getBoundingClientRect().top + window.scrollY : -1)
    const rects = Array.from(document.querySelectorAll('img, [class*="gallery"], [class*="mainImage"]'))
      .map(e => e.getBoundingClientRect()).filter(r => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)
    return {
      fotoBottom: rects.length > 0 ? rects[0].bottom + window.scrollY : 0,
      nombre: y(document.querySelector('h1')),
      selector: y(document.querySelector('[data-testid="precio-divisa"] [role="radiogroup"]')),
      precio: y(document.querySelector('[data-testid="precio-principal"]')),
      pastillas: y(document.querySelector('[data-testid="precio-divisa"] ul')),
    }
  })
  expect(orden.fotoBottom).toBeLessThanOrEqual(orden.nombre + 1)
  expect(orden.nombre).toBeLessThan(orden.selector)
  expect(orden.selector).toBeLessThan(orden.precio)
  expect(orden.precio).toBeLessThan(orden.pastillas)
  await page.screenshot({ path: 'tests/__capturas__/selector-ficha-375-divisa.png', fullPage: true })
  await bloque.getByRole('radio', { name: /Bolívares/ }).click()
  await page.screenshot({ path: 'tests/__capturas__/selector-ficha-375-bs.png', fullPage: true })
})

test('captura del mockup C a 375 px (referencia)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  try {
    await page.goto(MOCKUP, { timeout: 15_000 })
    await page.screenshot({ path: 'tests/__capturas__/selector-mockup-375.png', fullPage: true })
  } catch {
    test.info().annotations.push({ type: 'mockup', description: 'no se pudo abrir el mockup local' })
  }
})

test('retoque ficha: "Comprar ahora" con degradado del mockup v2 y sube 1px al pasar', async ({ page }) => {
  await page.goto(`/catalogo-premium/${SLUG}/p/${idCon}`)
  const btn = page.getByRole('button', { name: /Comprar ahora/ })
  const estilo = await btn.evaluate((el: HTMLElement) => { const s = getComputedStyle(el); return { img: s.backgroundImage, sombra: s.boxShadow } })
  expect(estilo.img).toContain('linear-gradient')
  expect(estilo.img).toContain('rgb(26, 95, 224)')
  expect(estilo.img).toContain('rgb(11, 79, 204)')
  expect(estilo.img).toContain('rgb(10, 67, 173)')
  expect(estilo.sombra).not.toBe('none')
  const y0 = (await btn.boundingBox())?.y ?? 0
  await btn.hover()
  await page.waitForTimeout(300)
  expect(y0 - ((await btn.boundingBox())?.y ?? y0)).toBeGreaterThan(0.5)
})
