import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Pedidos · detalle legible y tarjeta del tablero. Negocio de prueba 217 (prefijo ZZB): siembra y limpia solo sus filas.
 * Caso real: varios "Caucho Continental Grand Prix 5000" de distintas medidas; la variante debe leerse completa en el modal y en la tarjeta.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const USER = 162
const NUM = 'ZZB-T01'
const CAUCHO = 'ZZB Caucho Continental Grand Prix 5000'
const CASCO = 'ZZB Casco Aero'
const TASA = 901.6175
const TOTAL = 111 * 3 + 50 // 700x25 ×1 + 700x28 ×2 + casco ×1

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })
test.describe.configure({ timeout: 90_000 })

function limpiar(): void {
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id=${BIZ} AND order_number='${NUM}')`)
  sql(`DELETE FROM orders WHERE business_id=${BIZ} AND order_number='${NUM}'`)
  sql(`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZB %')`)
  sql(`DELETE FROM products WHERE business_id=${BIZ} AND name LIKE 'ZZB %'`)
}

function sembrar(): void {
  limpiar()
  sql(`INSERT INTO products (business_id, name, sku, price_per_unit_usd, has_variants, updated_at) VALUES (${BIZ}, '${CAUCHO}', 'ZZB-CGP', 111, 1, NOW(3))`)
  const caucho = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${CAUCHO}'`))
  sql(`INSERT INTO products (business_id, name, sku, price_per_unit_usd, updated_at) VALUES (${BIZ}, '${CASCO}', 'ZZB-CAS', 50, NOW(3))`)
  const casco = Number(sql(`SELECT id FROM products WHERE business_id=${BIZ} AND name='${CASCO}'`))
  sql(`INSERT INTO product_variants (product_id, tipo, valor, sku, stock) VALUES (${caucho}, 'personalizado', '700x25', 'ZZB-C25', 8), (${caucho}, 'personalizado', '700x28', 'ZZB-C28', 5)`)
  const v25 = Number(sql(`SELECT id FROM product_variants WHERE product_id=${caucho} AND valor='700x25'`))
  const v28 = Number(sql(`SELECT id FROM product_variants WHERE product_id=${caucho} AND valor='700x28'`))
  const totalBs = (TOTAL * TASA).toFixed(2)
  sql(`INSERT INTO orders (business_id, order_number, status, origin, client_name, client_phone, delivery_fee, total_usd, total_bs, rate_used, price_mode, updated_at) VALUES (${BIZ}, '${NUM}', 'received', 'pos', 'ZZB Cliente', '04125550000', 0, ${TOTAL}, ${totalBs}, ${TASA}, 'bcv', NOW(3))`)
  const orden = Number(sql(`SELECT id FROM orders WHERE business_id=${BIZ} AND order_number='${NUM}'`))
  sql(`INSERT INTO order_items (order_id, product_id, product_name, variant_label, variant_id, quantity, price_per_unit_usd, subtotal_usd, price_source) VALUES
    (${orden}, ${caucho}, '${CAUCHO}', '700x25', ${v25}, 1, 111, 111, 'bcv'),
    (${orden}, ${caucho}, '${CAUCHO}', '700x28', ${v28}, 2, 111, 222, 'bcv'),
    (${orden}, ${casco}, '${CASCO}', NULL, NULL, 1, 50, 50, 'bcv')`)
}

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER, businessId: BIZ, role: 'admin', name: 'Admin ZZB' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

test.beforeAll(() => { sembrar() })
test.afterAll(() => { limpiar() })

const tarjeta = (page: Page) => page.getByRole('listitem', { name: `Pedido ${NUM}` })
const modal = (page: Page) => page.getByRole('dialog', { name: `Pedido ${NUM}` })
const filas = (page: Page) => modal(page).locator('ul[aria-label="Ítems del pedido"] > li')

async function abrir(page: Page): Promise<void> {
  await login(page)
  await page.goto('/pedidos')
  await tarjeta(page).click()
  await expect(modal(page)).toBeVisible()
  await expect(filas(page)).toHaveCount(3)
}

test('tarjeta: 2 líneas de ítems con variante, "+N más" y total en USD y Bs', async ({ page }) => {
  await login(page)
  await page.goto('/pedidos')
  const t = tarjeta(page)
  await expect(t).toBeVisible()
  await expect(t.getByText(`1× ${CAUCHO} · 700x25`)).toBeVisible()
  await expect(t.getByText(`2× ${CAUCHO} · 700x28`)).toBeVisible()
  await expect(t.getByText('+1 más')).toBeVisible()
  await expect(t).toContainText(`$${TOTAL}.00 · Bs`)
})

test('modal: la variante se lee completa y cada línea muestra precio unitario y total en USD y Bs', async ({ page }) => {
  await abrir(page)
  for (const medida of ['700x25', '700x28']) {
    const v = modal(page).getByText(medida, { exact: true })
    await expect(v).toBeVisible()
    expect(await v.evaluate((el) => el.scrollWidth <= el.clientWidth), `${medida} sin recortar`).toBe(true)
  }
  await expect(modal(page).getByText('SKU ZZB-C28')).toBeVisible()
  const linea = filas(page).nth(1)
  await expect(linea).toContainText(/\$111\.00 c\/u · Bs /)
  await expect(linea.getByTestId('line-total')).toContainText(/\$222\.00\s*Bs /)
})

test('modal: cerrar con cambios pide confirmación; sin cambios cierra directo', async ({ page }) => {
  await abrir(page)
  const cerrar = modal(page).getByRole('button', { name: 'Cerrar', exact: true }).last()
  await filas(page).first().getByRole('button', { name: /Aumentar cantidad/ }).click()
  await cerrar.click()
  const aviso = page.getByRole('alertdialog', { name: 'Tienes cambios sin guardar' })
  await expect(aviso).toBeVisible()
  await aviso.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(modal(page)).toBeVisible()
  await cerrar.click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cerrar sin guardar' }).click()
  await expect(modal(page)).toBeHidden()

  await tarjeta(page).click()
  await expect(modal(page)).toBeVisible()
  await modal(page).getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(modal(page)).toBeHidden()
})

test('modal: eliminar una línea ofrece "Deshacer"', async ({ page }) => {
  await abrir(page)
  await filas(page).nth(2).getByRole('button', { name: /Eliminar/ }).click()
  await expect(filas(page)).toHaveCount(2)
  await modal(page).getByRole('button', { name: 'Deshacer' }).click()
  await expect(filas(page)).toHaveCount(3)
  await expect(filas(page).nth(2)).toContainText(CASCO)
})

test('modal: producto con variantes pide elegir la medida antes de agregar', async ({ page }) => {
  await abrir(page)
  await modal(page).getByLabel('Buscar producto').fill('ZZB Caucho')
  await modal(page).getByRole('option').filter({ hasText: CAUCHO }).getByRole('button').first().click()
  const lista = modal(page).getByRole('option').filter({ hasText: CAUCHO })
  await expect(lista).toContainText('Stock 8')
  await expect(lista).toContainText('Stock 5')
  await lista.getByRole('button', { name: /700x25/ }).click()
  await expect(filas(page)).toHaveCount(3) // misma variante: suma cantidad, no duplica la línea
  await expect(filas(page).first().locator('[class*="qtyVal"]')).toHaveText('2')
})

test('guardar cambios conserva la variante de cada línea (variant_id)', async ({ page }) => {
  await abrir(page)
  await filas(page).first().getByRole('button', { name: /Aumentar cantidad/ }).click()
  await modal(page).getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Pedido actualizado')).toBeVisible()
  const ids = sql(`SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.business_id=${BIZ} AND o.order_number='${NUM}' AND oi.variant_label IN ('700x25','700x28') AND oi.variant_id IS NOT NULL`)
  expect(Number(ids)).toBe(2)
})
