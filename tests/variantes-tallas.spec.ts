import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * Editor de tallas (Productos > Nuevo / Editar), negocio 87, servidor local (E2E_BASE_URL, por defecto 3002):
 * ropa con 3 tallas y stock, calzado con 4 tallas (equivalencia US/cm), código de barras por talla
 * (duplicado en línea, escaneo en el POS) y venta de una talla con descuento de su stock.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME_ROPA = `ZZ Franela Tallas ${TAG}`
const NAME_COPIA = `ZZ Franela Copia ${TAG}`
const NAME_ZAP = `ZZ Zapato Tallas ${TAG}`
const BC_S = `97${TAG}1`
const BC_M = `97${TAG}2`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

async function fillBasics(page: Page, name: string): Promise<void> {
  await page.goto('/productos/nuevo')
  await page.locator('#np-name').fill(name)
  await page.getByRole('tab', { name: 'Precio' }).click()
  await page.locator('#np-cost').fill('10')
  await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
  await page.locator('label[aria-label="Este producto tiene tallas o colores"]').click()
}

function rowOf(page: Page, talla: string) {
  return page.locator('[role="row"]').filter({ has: page.getByText(talla, { exact: true }) }).last()
}

test.afterAll(() => {
  for (const n of [NAME_ROPA, NAME_COPIA, NAME_ZAP]) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${n}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM sale_items WHERE product_id=${id}`)
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM product_variants WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

test('ropa: 3 tallas con stock y código de barras, guarda y recarga', async ({ page }) => {
  await login(page)
  await fillBasics(page, NAME_ROPA)

  await page.getByRole('button', { name: /^Ropa/ }).click()
  for (const t of ['S', 'M', 'L']) await page.getByRole('button', { name: t, exact: true }).click()
  await expect(page.getByText('Stock total: 0 und')).toBeVisible()

  for (const [t, n] of [['S', '4'], ['M', '3'], ['L', '2']]) {
    await rowOf(page, t).getByLabel('Stock', { exact: true }).fill(n)
  }
  await expect(page.getByText('Stock total: 9 und')).toBeVisible()
  await rowOf(page, 'S').getByLabel('Código de barras').fill(BC_S)
  await rowOf(page, 'M').getByLabel('Código de barras').fill(BC_M)
  await rowOf(page, 'L').getByLabel('SKU (opcional)').fill(`SKU-${TAG}`)
  await rowOf(page, 'M').getByLabel('Precio propio (opcional)').fill('25')

  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')

  const out = sql(`SELECT v.valor,v.stock,IFNULL(v.barcode,''),IFNULL(v.sku,''),IFNULL(v.price_usd,'') FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.business_id=${BUSINESS_ID} AND p.name='${NAME_ROPA}' ORDER BY v.valor`)
  expect(out).toContain(`L\t2\t\tSKU-${TAG}\t`)
  expect(out).toMatch(new RegExp(`M\\t3\\t${BC_M}\\t\\t25`))
  expect(out).toContain(`S\t4\t${BC_S}`)

  // recarga: la edición trae las tallas guardadas
  const id = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${NAME_ROPA}'`)
  await page.goto(`/productos/${id}/editar`)
  await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
  await expect(rowOf(page, 'M').getByLabel('Código de barras')).toHaveValue(BC_M)
  await expect(page.getByText('Stock total: 9 und')).toBeVisible()
  expect(Number(sql(`SELECT SUM(quantity-waste) FROM inventory_entries WHERE product_id=${id}`))).toBe(9)
})

test('código de barras repetido: error en línea y no deja guardar', async ({ page }) => {
  await login(page)
  await fillBasics(page, NAME_COPIA)
  await page.getByRole('button', { name: /^Ropa/ }).click()
  await page.getByRole('button', { name: 'XL', exact: true }).click()
  await page.getByRole('button', { name: '2XL', exact: true }).click()

  const xl = rowOf(page, 'XL').getByLabel('Código de barras')
  await xl.fill(BC_S)
  await xl.blur()
  await expect(page.getByText(/ya pertenece a la talla S/)).toBeVisible()

  await xl.fill(BC_M)
  await xl.blur()
  await expect(page.getByText(/ya pertenece a la talla M/)).toBeVisible()

  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByText('Corrige los códigos de barras marcados en rojo.')).toBeVisible()
  await expect(page).toHaveURL(/\/productos\/nuevo/)
})

test('calzado hombre: 4 tallas con equivalencia US/cm y mismo stock para todas', async ({ page }) => {
  await login(page)
  await fillBasics(page, NAME_ZAP)
  await page.getByRole('button', { name: /^Calzado hombre/ }).click()
  await expect(page.getByRole('button', { name: /^42\s*US 8\.5$/ })).toBeVisible()
  for (const t of ['40', '41', '42', '43']) await page.getByRole('button', { name: new RegExp(`^${t}\\s*US`) }).click()
  await expect(rowOf(page, '42').getByText('US 8.5 · 26.5 cm')).toBeVisible()

  await page.getByLabel('Mismo stock para todas').fill('5')
  await page.getByRole('button', { name: 'Aplicar a todas' }).click()
  await expect(page.getByText('Stock total: 20 und')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.waitForURL('**/productos')

  expect(sql(`SELECT COUNT(*),SUM(v.stock),MIN(v.variant_group) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.business_id=${BUSINESS_ID} AND p.name='${NAME_ZAP}'`))
    .toBe('4\t20\tzap-caballero')
})

test('POS: el código de una talla abre esa talla y la venta descuenta su stock', async ({ page }) => {
  await login(page)
  const ropa = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name='${NAME_ROPA}'`)
  const vM = sql(`SELECT id FROM product_variants WHERE product_id=${ropa} AND valor='M'`)

  const found = await page.request.get(`/api/products/search?q=${BC_M}&limit=5`)
  const body = (await found.json()) as { products: Array<{ id: number; matched_variant_id: number | null }> }
  expect(body.products[0].id).toBe(Number(ropa))
  expect(body.products[0].matched_variant_id).toBe(Number(vM))

  const methods = (await (await page.request.get('/api/payment-methods')).json()) as { methods?: Array<{ id: number }>; payment_methods?: Array<{ id: number }> }
  const pm = (methods.methods ?? methods.payment_methods ?? [])[0]?.id
  const rate = Number(sql(`SELECT rate FROM dollar_rates WHERE business_id=${BUSINESS_ID} ORDER BY id DESC LIMIT 1`)) || 1
  const res = await page.request.post('/api/sales', {
    data: {
      items: [{ product_id: Number(ropa), variant_id: Number(vM), quantity: 1, sale_mode: 'unit', price_per_unit_usd: 25 }],
      status: 'paid', origin: 'pos',
      payments: [{ payment_method_id: pm, amount_usd: 40, amount_bs: Math.round(40 * rate * 100) / 100 }],
    },
  })
  expect(res.status(), await res.text()).toBeLessThan(300)
  expect(sql(`SELECT stock FROM product_variants WHERE id=${vM}`)).toBe('2')
})
