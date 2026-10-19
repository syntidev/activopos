import { test, expect } from '@playwright/test'
import path from 'path'
import { BASE, BUSINESS_ID, login, sql } from './alta-helpers'

/**
 * Alta rápida (/captura-etiquetas) en el negocio 87, servidor local en el puerto 3101.
 * Requiere el servidor con LABEL_CAPTURE_BUSINESS_IDS=87.
 */
const SHOTS = process.env.ALTA_SHOTS_DIR ?? path.join(__dirname, 'screenshots')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

const CODE = `99${String(Date.now()).slice(-11)}`
const TITLE = 'ZZ Prueba Alta Rápida'
let productId = 0

test('escribir código a mano, guardar y ver el producto con su stock en la DB', async ({ page }) => {
  await login(page)
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.getByPlaceholder('Escribir el código a mano').fill(CODE)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByLabel('Título')).toBeVisible()
  await expect(page.getByLabel('Código de barras', { exact: true })).toHaveValue(CODE)

  await page.getByLabel('Título').fill(TITLE)
  await page.getByLabel('Cantidad', { exact: true }).fill('3')
  await page.locator('select').selectOption({ label: 'Accesorios' })
  await page.getByLabel('Subcategoría (opcional)').fill('Prueba QA')
  await page.getByLabel('Precio al público (USD)').fill('12.50')
  await page.getByLabel('Precio al mayor (USD)').fill('15')
  await expect(page.getByText('El precio al mayor es más alto')).toBeVisible()
  await expect(page.getByText(/\$12\.50 · Bs\. /)).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'alta-1280-form.png'), fullPage: true })

  await page.getByLabel('Precio al mayor (USD)').fill('10')
  await page.getByRole('button', { name: 'Guardar y siguiente' }).click()
  await expect(page.getByText(`Guardado: ${TITLE}`)).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, 'alta-1280-guardado.png'), fullPage: true })

  const row = sql(`SELECT id, name, price_per_unit_usd, wholesale_price_usd, has_variants, active, is_available, available_in_pos, catalog_visibility, show_in_catalog, subcategory FROM products WHERE business_id=${BUSINESS_ID} AND barcode='${CODE}'`)
  const cols = row.split('\t')
  productId = Number(cols[0])
  expect(cols.slice(1)).toEqual([TITLE, '12.50', '10.00', '0', '1', '1', '1', 'visible', '1', 'Prueba QA'])
  const stock = sql(`SELECT COALESCE(SUM(quantity - waste),0), COUNT(*) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId} AND entry_type='adjustment'`)
  expect(stock).toBe('3.000\t1')
})

test('el mismo código no duplica: ofrece sumar cantidad', async ({ page }) => {
  await login(page)
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
  await page.getByPlaceholder('Escribir el código a mano').fill(CODE)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText(`Ya existe: ${TITLE}`)).toBeVisible()
  await page.getByLabel('Cantidad a sumar').fill('2')
  await page.getByRole('button', { name: 'Sumar cantidad' }).click()
  await expect(page.getByText(/\+2 a ZZ Prueba/)).toBeVisible()

  expect(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND barcode='${CODE}'`)).toBe('1')
  expect(sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)).toBe('5.000')
})

test('lista de la sesión: corregir cantidad y precios', async ({ page }) => {
  await login(page)
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
  await page.getByPlaceholder('Escribir el código a mano').fill(CODE)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByLabel('Cantidad a sumar').fill('1')
  await page.getByRole('button', { name: 'Sumar cantidad' }).click()
  await expect(page.getByText('Cargado en esta sesión (1)')).toBeVisible()

  await page.getByRole('button', { name: 'Corregir' }).click()
  await page.getByLabel('Cantidad cargada aquí').fill('0')
  await page.getByLabel('Público (USD)').fill('14')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(/\$14\.00 · Bs\./)).toBeVisible()

  expect(sql(`SELECT price_per_unit_usd FROM products WHERE id=${productId}`)).toBe('14.00')
  expect(sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)).toBe('5.000')
})

test('el POS encuentra el producto por ese barcode y una venta paid descuenta el stock', async ({ page }) => {
  await login(page)
  const found = await page.request.get(`/api/products/search?q=${CODE}`)
  expect(found.ok()).toBeTruthy()
  const hit = ((await found.json()) as { products: { id: number; name: string }[] }).products.find(p => p.id === productId)
  expect(hit?.name).toBe(TITLE)

  const rate = Number(sql(`SELECT rate FROM dollar_rates ORDER BY fetched_at DESC LIMIT 1`))
  const sale = await page.request.post('/api/sales', {
    data: {
      items: [{ product_id: productId, quantity: 2, sale_mode: 'unit' }],
      status: 'paid',
      origin: 'pos',
      payments: [{ payment_method_id: 341, amount_usd: 28, amount_bs: Math.round(28 * rate * 100) / 100 }],
    },
  })
  expect(sale.status(), await sale.text()).toBe(201)
  const left = sql(`SELECT SUM(quantity - waste) FROM inventory_entries WHERE business_id=${BUSINESS_ID} AND product_id=${productId}`)
  expect(left).toBe('3.000')
})

test('móvil 375: sin desborde horizontal', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/captura-etiquetas')
  await page.getByRole('tab', { name: 'Alta rápida' }).click()
  await page.getByPlaceholder('Escribir el código a mano').fill(`98${String(Date.now()).slice(-11)}`)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByLabel('Título')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: path.join(SHOTS, 'alta-375-form.png'), fullPage: true })
})

test('un código que ya usa una variante del negocio se rechaza con el mensaje y no crea nada', async ({ page }) => {
  await login(page)
  const VARIANT_CODE = `96${String(Date.now()).slice(-11)}`
  sql(`INSERT INTO product_variants (product_id, tipo, valor, precio_extra, stock, is_active, sort_order, barcode) VALUES (${productId}, 'talla', 'ZZ', 0, 0, 1, 0, '${VARIANT_CODE}')`)
  try {
    await page.goto('/captura-etiquetas')
    await page.getByRole('tab', { name: 'Alta rápida' }).click()
    await page.getByPlaceholder('Escribir el código a mano').fill(VARIANT_CODE)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await page.getByLabel('Título').fill('ZZ Choque con variante')
    await page.getByLabel('Cantidad', { exact: true }).fill('1')
    await page.locator('select').selectOption({ label: 'Accesorios' })
    await page.getByLabel('Precio al público (USD)').fill('5')
    await page.getByRole('button', { name: 'Guardar y siguiente' }).click()
    await expect(page.getByText(/ya pertenece a la variante ZZ de/)).toBeVisible()
    expect(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND (barcode='${VARIANT_CODE}' OR name='ZZ Choque con variante')`)).toBe('0')
  } finally {
    sql(`DELETE FROM product_variants WHERE barcode='${VARIANT_CODE}' AND product_id=${productId}`)
  }
})

test('rate limit: /api/quick-add/context responde 429 antes de 31 llamadas por minuto', async ({ page }) => {
  await login(page)
  let limitedAt = 0
  for (let i = 1; i <= 40 && !limitedAt; i++) {
    if ((await page.request.get('/api/quick-add/context')).status() === 429) limitedAt = i
  }
  expect(limitedAt, 'debe aparecer un 429').toBeGreaterThan(0)
  expect(limitedAt).toBeLessThanOrEqual(31)
})
