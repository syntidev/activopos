import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * SKU / Referencia del producto (products.sku) en nuevo y editar, y visible bajo el nombre en la lista.
 * Negocio 87, servidor local (E2E_BASE_URL, por defecto 3002).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME_EDIT = `ZZ SKU Editar ${TAG}`
const NAME_NEW = `ZZ SKU Nuevo ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const skuOf = (name: string) => sql(`SELECT IFNULL(sku,'NULL') FROM products WHERE business_id=${BUSINESS_ID} AND name='${name}'`)

test.afterAll(() => {
  for (const n of [NAME_EDIT, NAME_NEW]) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${n}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

test('nuevo: el campo SKU / Referencia existe con ayuda y el código de barras ya no dice SKU', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await expect(page.getByLabel('SKU / Referencia')).toBeVisible()
  await expect(page.getByText('Código interno o referencia del fabricante')).toBeVisible()
  await expect(page.locator('#np-barcode')).not.toHaveAttribute('placeholder', /SKU/)

  await page.locator('#np-name').fill(NAME_NEW)
  await page.getByLabel('SKU / Referencia').fill('REF-NUEVO-1')
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-price').fill('5')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')
  expect(skuOf(NAME_NEW)).toBe('REF-NUEVO-1')
})

test('editar: cambiar el SKU, guardar, recargar y ver el valor; la lista lo muestra bajo el nombre', async ({ page }) => {
  await login(page)
  const created = await page.request.post('/api/products', {
    data: { name: NAME_EDIT, sku: 'REF-ANTES', cost_per_unit_usd: 2, price_per_unit_usd: 3, is_fixed_price: true },
  })
  expect(created.status()).toBe(201)
  const id = ((await created.json()) as { product: { id: number } }).product.id

  await page.goto(`/productos/${id}/editar`)
  await expect(page.getByLabel('SKU / Referencia')).toHaveValue('REF-ANTES')
  await page.getByLabel('SKU / Referencia').fill('REF-DESPUES')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForURL('**/productos')
  expect(skuOf(NAME_EDIT)).toBe('REF-DESPUES')

  await page.goto(`/productos/${id}/editar`)
  await expect(page.getByLabel('SKU / Referencia')).toHaveValue('REF-DESPUES')

  await page.goto('/productos')
  await page.getByPlaceholder(/Nombre, SKU/).fill(NAME_EDIT)
  await expect(page.getByText('SKU REF-DESPUES')).toBeVisible()

  // vaciar el campo borra el SKU
  await page.goto(`/productos/${id}/editar`)
  await page.getByLabel('SKU / Referencia').fill('')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForURL('**/productos')
  expect(skuOf(NAME_EDIT)).toBe('NULL')
})
