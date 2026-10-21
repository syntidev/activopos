import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * Formulario de producto con pestañas (negocio 87, servidor local; E2E_BASE_URL, por defecto 3002):
 * pestañas con teclado, punto de error + salto a la pestaña con el campo inválido, "Sin costo cargado",
 * barra de pestañas que se queda arriba al hacer scroll y modal de eliminar con carga, error y éxito.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME = `ZZ Pestañas ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

test.afterAll(() => {
  const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${NAME}' LIMIT 1`)
  if (!id) return
  sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
  sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
})

test('las 6 pestañas existen y se mueven con flechas', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText(['Básico', 'Precio', 'Inventario y variantes', 'Imágenes', 'Catálogo', 'Avanzado'])
  await page.getByRole('tab', { name: 'Básico' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Precio' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#np-price')).toBeVisible()
  await expect(page.locator('#np-name')).toBeHidden()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Avanzado' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Detalles internos' }).click()
  await expect(page.locator('#np-location')).toBeVisible()
})

test('guardar sin nombre: punto de error en Básico y salta ahí', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-price').fill('9')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByRole('tab', { name: /Básico/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: /Básico/ }).getByText('(tiene campos por corregir)')).toBeAttached()
  await expect(page.getByText('El nombre es obligatorio')).toBeVisible()
})

test('"No sé cuánto me cuesta": sin utilidad estimada', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('label[aria-label="Calcular con el sistema"]').click()
  await page.locator('label[aria-label="Costo desconocido"]').click()
  await page.locator('#np-price').fill('120')
  await expect(page.getByText('Sin costo cargado')).toBeVisible()
  await expect(page.getByText('Utilidad estimada')).toHaveCount(0)
})

test('la barra de pestañas se queda arriba al hacer scroll', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.goto('/productos/nuevo')
  await page.getByRole('tab', { name: 'Catálogo' }).click()
  await page.evaluate(() => { const r = document.getElementById('main-content'); if (r) r.scrollTop = 400 })
  const top = await page.getByRole('tablist').evaluate(el => el.getBoundingClientRect().top)
  const rootTop = await page.locator('#main-content').evaluate(el => el.getBoundingClientRect().top)
  expect(Math.abs(top - rootTop), `top=${top} root=${rootTop} scroll=${await page.locator('#main-content').evaluate(el => el.scrollTop)}`).toBeLessThan(4)
})

test('eliminar: error de la API visible, luego éxito con aviso', async ({ page }) => {
  await login(page)
  const created = await page.request.post('/api/products', {
    data: { name: NAME, cost_per_unit_usd: 2, price_per_unit_usd: 3, is_fixed_price: true },
  })
  expect(created.status()).toBe(201)
  const id = ((await created.json()) as { product: { id: number } }).product.id

  await page.goto('/productos')
  await page.getByPlaceholder(/Nombre, SKU/).first().fill(NAME)
  await page.getByRole('button', { name: `Eliminar ${NAME}` }).click()
  await expect(page.getByText('¿Eliminar este producto?')).toBeVisible()

  let fail = true
  await page.route(`**/api/products/${id}`, async route => {
    if (route.request().method() === 'DELETE' && fail) {
      await new Promise(r => setTimeout(r, 400))
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'No se pudo borrar: error de prueba' }) })
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Eliminando…' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo borrar: error de prueba' })).toBeVisible()
  await expect(page.getByText('¿Eliminar este producto?')).toBeVisible()

  fail = false
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(page.getByText(`"${NAME}" eliminado`)).toBeVisible()
  await expect(page.getByText('¿Eliminar este producto?')).toBeHidden()
})
