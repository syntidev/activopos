import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * T1 etiqueta Divisa, T2 + ADENDUM 1 (Precio mínimo: solo BCV y Divisa; cálculo detrás de un toggle),
 * T3 contenedor centrado (pestañas + contenido + SaveBar). Negocio 87, servidor local (E2E_BASE_URL, por defecto 3002).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME_EDIT = `ZZ Divisa Editar ${TAG}`
const NAME_NEW = `ZZ Divisa Nuevo ${TAG}`
const SHOTS = process.env.SHOTS_DIR

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const row = (name: string) =>
  sql(`SELECT CONCAT(price_per_unit_usd,'|',IFNULL(wholesale_price_usd,'NULL')) FROM products WHERE business_id=${BUSINESS_ID} AND name='${name}'`)

test.afterAll(() => {
  for (const n of [NAME_EDIT, NAME_NEW]) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${n}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

test('T1: el precio mayorista ahora se llama Divisa en el formulario', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await page.getByRole('tab', { name: 'Precio' }).click()
  await expect(page.getByLabel('Precio Divisa ($)')).toBeVisible()
  await expect(page.getByLabel('Precio BCV ($)')).toBeVisible()
  const panel = page.locator('#ppanel-precio')
  expect(await panel.innerText()).not.toMatch(/ayorista/i)
})

test('ADENDUM 1 + T2: solo Precio BCV y Precio Divisa a la vista; el cálculo vive detrás de un toggle apagado; editar no recalcula', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await page.getByRole('tab', { name: 'Precio' }).click()

  await expect(page.getByLabel('Calcular con el sistema', { exact: true })).not.toBeChecked()
  for (const hidden of ['#np-cost', '#np-margin', '#np-wholesale-pct']) await expect(page.locator(hidden)).toHaveCount(0)
  await expect(page.getByText('No sé cuánto me cuesta')).toHaveCount(0)
  await expect(page.locator('#np-price')).toBeEditable()
  await expect(page.locator('#np-wholesale')).toBeEditable()

  // Producto nuevo con solo nombre + los dos precios: se guarda sin costo.
  await page.getByRole('tab', { name: 'Básico' }).click()
  await page.locator('#np-name').fill(NAME_NEW)
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-price').fill('10')
  await page.locator('#np-wholesale').fill('8')

  // Al encender el grupo aparecen costo, margen y el descuento Divisa.
  await page.locator('label[aria-label="Calcular con el sistema"]').click()
  await expect(page.locator('#np-cost')).toBeVisible()
  await page.locator('#np-cost').fill('4')
  await page.locator('#np-margin').fill('60')
  await expect(page.locator('#np-price')).toHaveValue('10.00')
  await page.locator('#np-wholesale-pct').fill('20')
  await expect(page.locator('#np-wholesale')).toHaveValue('8.00')
  await page.locator('label[aria-label="Calcular con el sistema"]').click() // apagar: el precio queda tal cual
  await expect(page.locator('#np-price')).toHaveValue('10.00')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')
  expect(row(NAME_NEW)).toBe('10.00|8.00')

  // Editar un producto guardado con cálculo y precio "raro": nada se recalcula.
  const created = await page.request.post('/api/products', {
    data: { name: NAME_EDIT, cost_per_unit_usd: 2, price_per_unit_usd: 3.37, wholesale_price_usd: 2.5, is_fixed_price: false },
  })
  expect(created.status()).toBe(201)
  const id = ((await created.json()) as { product: { id: number } }).product.id
  await page.goto(`/productos/${id}/editar`)
  await page.getByRole('tab', { name: 'Precio' }).click()
  await expect(page.getByLabel('Calcular con el sistema', { exact: true })).not.toBeChecked()
  await expect(page.locator('#np-price')).toHaveValue('3.37')
  await expect(page.locator('#np-wholesale')).toHaveValue('2.5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForURL('**/productos')
  expect(row(NAME_EDIT)).toBe('3.37|2.50')
})

test('T3: pestañas, contenido y SaveBar comparten ancho, centrados y compactos (375/768/1440)', async ({ page }) => {
  await login(page)
  for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/productos/nuevo')
    await page.locator('#np-name').waitFor()
    const tabs = await page.getByRole('tablist').locator('..').boundingBox()
    const bar = await page.getByRole('button', { name: 'Guardar producto' }).locator('..').boundingBox()
    const save = await page.getByRole('button', { name: 'Guardar producto' }).boundingBox()
    const main = await page.locator('#main-content').boundingBox()
    if (!tabs || !bar || !save || !main) throw new Error('sin cajas')

    expect(Math.abs(tabs.x - bar.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(tabs.width - bar.width)).toBeLessThanOrEqual(1)
    const left = tabs.x - main.x
    const right = main.x + main.width - (tabs.x + tabs.width)
    expect(Math.abs(left - right)).toBeLessThanOrEqual(24) // simétrico (el scroller puede reservar scrollbar)
    expect(bar.x + bar.width).toBeGreaterThanOrEqual(save.x + save.width) // el botón queda dentro de la barra
    expect(save.width).toBeLessThan(w < 640 ? 240 : 260) // ancho propio, no estirado
    expect(save.x + save.width).toBeGreaterThan(bar.x + bar.width - 40) // alineado a la derecha
    if (w >= 1440) expect(tabs.width).toBeLessThanOrEqual(1200)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/layout_${w}.png` })
  }
})
