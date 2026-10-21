import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * T4: UI de financiamiento según .doc/CONTRATO_FINANCIAMIENTO.md.
 * Configuración (modo, nombre, frase, logo subido) y "Excluir de financiamiento" en el producto.
 * Negocio 87, servidor local; restaura settings.financing al terminar.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME = `ZZ Financia ${TAG}`
// PNG 1x1 válido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

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
  const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${NAME}' LIMIT 1`)
  if (!id) return
  sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
  sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
})

test('T4: configurar otra empresa con frase y logo; el producto se excluye con el toggle invertido', async ({ page }) => {
  await login(page)
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Tema Visual' }).click()

  await page.getByRole('button', { name: 'Activar financiamiento' }).click()
  await page.getByText('Otra empresa', { exact: true }).click()
  await page.getByLabel('Nombre de la empresa').fill('Krece')
  await page.getByLabel('Frase en el catálogo').fill('Paga en cuotas con Krece')
  await page.locator('h3:has-text("Financiamiento")').locator('..').locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('button', { name: /Quitar/i }).first()).toBeVisible({ timeout: 30000 })
  await page.getByRole('button', { name: 'Guardar financiamiento' }).click()
  await expect(page.getByText('Financiamiento guardado.')).toBeVisible()
  const saved = sql(`SELECT CONCAT(JSON_UNQUOTE(JSON_EXTRACT(settings,'$.financing.mode')),'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.financing.provider_name')),'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.financing.phrase')),'|',JSON_UNQUOTE(JSON_EXTRACT(settings,'$.financing.logo_url'))) FROM businesses WHERE id=${BUSINESS_ID}`)
  expect(saved).toMatch(new RegExp(`^other\\|Krece\\|Paga en cuotas con Krece\\|/storage/tenants/${BUSINESS_ID}/financing/[0-9a-f-]{36}\\.webp$`))

  // Producto: por defecto entra (casilla desmarcada); se marca solo para excluirlo.
  await page.goto('/productos/nuevo')
  await page.locator('#np-name').fill(NAME)
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-price').fill('5')
  await page.getByRole('tab', { name: 'Catálogo' }).click()
  await expect(page.getByLabel('Excluir de financiamiento', { exact: true })).not.toBeChecked()
  await page.locator('label[aria-label="Excluir de financiamiento"]').click()
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')
  expect(sql(`SELECT financing_excluded FROM products WHERE business_id=${BUSINESS_ID} AND name='${NAME}'`)).toBe('1')
})
