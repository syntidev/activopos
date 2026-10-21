import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * Fichas públicas (catálogo normal y premium) según business.financing:
 * Cashea (preset, sello de siempre), otra empresa (logo subido + frase), propio (solo frase),
 * producto excluido y financiamiento desactivado: no se pinta nada. Negocio 87, servidor local.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const SLUG = 'onbike'
const TAG = String(Date.now()).slice(-8)
const NAME_OK = `ZZ Fin Ficha ${TAG}`
const NAME_EX = `ZZ Fin Excl ${TAG}`
// PNG 1x1 válido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

let idOk = 0
let idEx = 0
let logoUrl = ''

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const resetSettings = () =>
  sql(`UPDATE businesses SET settings = JSON_REMOVE(JSON_REMOVE(IFNULL(settings, JSON_OBJECT()), '$.financing'), '$.catalog_financing_badge') WHERE id = ${BUSINESS_ID}`)

test.beforeAll(resetSettings)
test.afterAll(() => {
  resetSettings()
  for (const id of [idOk, idEx]) {
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

const PAGES = (id: number) => [`/catalogo/${SLUG}/p/${id}`, `/catalogo-premium/${SLUG}/p/${id}`]

/** Abre la ficha y espera (recargando) a que el servidor ya refleje la configuración. */
async function ficha(page: Page, path: string, name: string): Promise<void> {
  await expect(async () => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
  }).toPass({ timeout: 90_000 })
}

async function setFinancing(page: Page, financing: Record<string, unknown>): Promise<void> {
  const r = await page.request.patch('/api/config/catalog', { data: { financing } })
  expect(r.status(), await r.text()).toBe(200)
}

test('preparar: dos productos visibles (uno excluido) y un logo subido', async ({ page }) => {
  await login(page)
  const mk = async (name: string) => {
    const r = await page.request.post('/api/products', {
      data: { name, cost_per_unit_usd: 1, price_per_unit_usd: 10, stock_quantity: 5, show_in_catalog: true, catalog_visibility: 'visible', is_available: true,
        ...(name === NAME_EX ? { financing_excluded: true } : {}) },
    })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idOk = await mk(NAME_OK)
  idEx = await mk(NAME_EX)
  const up = await page.request.post('/api/upload/image', { multipart: { type: 'financing', file: { name: 'logo.png', mimeType: 'image/png', buffer: PNG } } })
  expect(up.status(), await up.text()).toBeLessThan(300)
  logoUrl = ((await up.json()) as { url: string }).url
  expect(logoUrl).toMatch(/\/financing\//)
})

for (const [i, label] of ['catálogo normal', 'catálogo premium'].entries()) {
  test(`${label}: Cashea (preset), otra empresa, propio, excluido y desactivado`, async ({ page }) => {
    await login(page)
    const path = PAGES(idOk)[i]
    const excl = PAGES(idEx)[i]
    const note = page.locator('[class*="FinancingNote_note"]')

    // Cashea: el sello de siempre, sin frase de texto (es la del preset).
    await setFinancing(page, { enabled: true, mode: 'cashea' })
    await ficha(page, path, NAME_OK)
    await expect(note.locator('img[src="/brand/cashea.png"]')).toBeVisible()
    await expect(note.locator('[class*="phrase"]')).toHaveCount(0)

    // Cashea con frase editada: se muestra la frase.
    await setFinancing(page, { enabled: true, mode: 'cashea', phrase: 'Tu compra en cuotas con Cashea' })
    await ficha(page, path, NAME_OK)
    await expect(note.getByText('Tu compra en cuotas con Cashea')).toBeVisible()

    // Otra empresa: su logo subido y su frase.
    await setFinancing(page, { enabled: true, mode: 'other', provider_name: 'Krece', phrase: 'Paga en cuotas con Krece', logo_url: logoUrl })
    await ficha(page, path, NAME_OK)
    await expect(note.locator(`img[src="${logoUrl}"]`)).toBeVisible()
    await expect(note.getByText('Paga en cuotas con Krece')).toBeVisible()
    await expect(note.locator('img[src="/brand/cashea.png"]')).toHaveCount(0)

    // Propio: solo la frase, sin logo.
    await setFinancing(page, { enabled: true, mode: 'own', phrase: 'Financiamos tu compra en 3 cuotas' })
    await ficha(page, path, NAME_OK)
    await expect(note.getByText('Financiamos tu compra en 3 cuotas')).toBeVisible()
    await expect(note.locator('img')).toHaveCount(0)

    // Producto excluido: no muestra nada aunque el financiamiento esté activo.
    await ficha(page, excl, NAME_EX)
    await expect(note).toHaveCount(0)

    // Desactivado: no se pinta nada.
    await setFinancing(page, { enabled: false, mode: 'own', phrase: 'Financiamos tu compra en 3 cuotas' })
    await expect(async () => {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: NAME_OK })).toBeVisible({ timeout: 15_000 })
      await expect(note).toHaveCount(0)
    }).toPass({ timeout: 90_000 })
  })
}
