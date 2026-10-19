import { test, expect, type Page } from '@playwright/test'
import { BASE, BUSINESS_ID, login, sql } from './alta-helpers'

/**
 * Alta rápida (/captura-etiquetas), negocio 87, servidor local en el puerto 3101:
 * - código de un producto con variantes (propio o de una variante): no ofrece "Sumar cantidad";
 * - el formulario abre al instante y las bases públicas solo completan un título vacío.
 * Requiere el servidor con LABEL_CAPTURE_BUSINESS_IDS=87.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

const TAG = String(Date.now()).slice(-9)
const PRODUCT_CODE = `95${TAG}1`
const VARIANT_CODE = `95${TAG}2`
const PRODUCT_NAME = `ZZ Prueba Con Variantes ${TAG}`
const VARIANT_MESSAGE = 'Este producto tiene variantes; edítalo en Productos'

async function openAlta(page: Page): Promise<void> {
  await login(page)
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
}

async function scan(page: Page, code: string): Promise<void> {
  await page.getByPlaceholder('Escribir el código a mano').fill(code)
  await page.getByRole('button', { name: 'Buscar' }).click()
}

async function createProduct(page: Page): Promise<number> {
  const context = (await (await page.request.get('/api/quick-add/context')).json()) as { categories: { id: number }[] }
  const res = await page.request.post('/api/quick-add/products', {
    data: { code: PRODUCT_CODE, name: PRODUCT_NAME, quantity: 2, category_id: context.categories[0].id, price_usd: 5 },
  })
  expect(res.status(), await res.text()).toBe(201)
  return ((await res.json()) as { product: { id: number } }).product.id
}

test('producto con variantes: ni su código ni el de una variante ofrecen sumar cantidad', async ({ page }) => {
  await openAlta(page)
  const productId = await createProduct(page)
  sql(`UPDATE products SET has_variants=1 WHERE id=${productId} AND business_id=${BUSINESS_ID}`)
  sql(`INSERT INTO product_variants (product_id, tipo, valor, precio_extra, stock, is_active, sort_order, barcode) VALUES (${productId}, 'talla', 'ZZ', 0, 0, 1, 0, '${VARIANT_CODE}')`)
  try {
    for (const code of [VARIANT_CODE, PRODUCT_CODE]) {
      await page.reload()
      await page.getByRole('tab', { name: 'Alta rápida' }).click()
      await scan(page, code)
      await expect(page.getByRole('heading', { name: PRODUCT_NAME })).toBeVisible()
      await expect(page.getByText(VARIANT_MESSAGE)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sumar cantidad' })).toHaveCount(0)
      await expect(page.getByLabel('Cantidad a sumar')).toHaveCount(0)
      await expect(page.getByLabel('Título')).toHaveCount(0)
    }
    // Nada cambió: el stock sigue en lo cargado al crear y no hay productos nuevos.
    expect(sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)).toBe('2.000')
    expect(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND barcode IN ('${PRODUCT_CODE}','${VARIANT_CODE}')`)).toBe('1')

    // La corrección del servidor también lo rechaza (404: no es un producto sin variantes).
    const patch = await page.request.patch(`/api/quick-add/products/${productId}`, { data: { quantity_delta: 1 } })
    expect(patch.status()).toBe(404)
  } finally {
    sql(`DELETE FROM product_variants WHERE barcode='${VARIANT_CODE}' AND product_id=${productId}`)
    sql(`UPDATE products SET has_variants=0 WHERE id=${productId} AND business_id=${BUSINESS_ID}`)
  }
})

test('el formulario abre al instante y la base pública completa el título solo si sigue vacío', async ({ page }) => {
  await openAlta(page)
  await page.route(/\/api\/quick-add\/title\?/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.fulfill({ json: { title: { title: 'Título de la base pública', source: 'open_food_facts' } } })
  })

  // Campo vacío: el formulario ya está, sin fuente; luego llega el título con su fuente.
  await scan(page, `94${TAG}1`)
  await expect(page.getByLabel('Título')).toBeVisible({ timeout: 1000 })
  await expect(page.getByLabel('Título')).toHaveValue('')
  await expect(page.getByText(/^Fuente:/)).toHaveCount(0)
  await expect(page.getByLabel('Título')).toHaveValue('Título de la base pública', { timeout: 5000 })
  await expect(page.getByText('Fuente: Open Food Facts')).toBeVisible()

  // Si la persona ya escribió, la respuesta tardía NO lo pisa y no se muestra fuente.
  await page.reload()
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
  await scan(page, `94${TAG}2`)
  await page.getByLabel('Título').fill('Mi título')
  await page.waitForTimeout(2500)
  await expect(page.getByLabel('Título')).toHaveValue('Mi título')
  await expect(page.getByText(/^Fuente:/)).toHaveCount(0)
})
