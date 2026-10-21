import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql, BUSINESS_ID, USER_ID } from './alta-helpers'

/**
 * ADENDUM 2: semáforo de precio BCV / Divisa en el POS y en el detalle del pedido (contrato .doc/CONTRATO_PRECIO_DIVISA.md).
 * Negocio 87, servidor local. Producto A con precio Divisa, producto B sin precio Divisa.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3002'
const TAG = String(Date.now()).slice(-8)
const NAME_A = `ZZ DivUI A ${TAG}`
const NAME_B = `ZZ DivUI B ${TAG}`
const SHOTS = process.env.SHOTS_DIR

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

let idA = 0
let idB = 0
let orderId = 0

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

test.afterAll(() => {
  const ids = [idA, idB].filter(Boolean).join(',')
  if (orderId) {
    sql(`DELETE FROM order_items WHERE order_id=${orderId}`)
    sql(`DELETE FROM orders WHERE id=${orderId} AND business_id=${BUSINESS_ID}`)
  }
  if (!ids) return
  const drafts = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (drafts) {
    sql(`DELETE FROM sale_items WHERE sale_id IN (${drafts})`)
    sql(`DELETE FROM sales WHERE id IN (${drafts}) AND business_id=${BUSINESS_ID} AND status='draft'`)
  }
  for (const id of [idA, idB]) {
    if (!id) continue
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`)
  }
})

test('POS: BCV por defecto, Divisa reprecia al instante, línea sin precio Divisa avisa y vuelve a BCV', async ({ page }) => {
  await login(page)
  const mk = async (name: string, price: number, wholesale: number | null) => {
    const r = await page.request.post('/api/products', {
      data: { name, cost_per_unit_usd: 1, price_per_unit_usd: price, is_fixed_price: true, stock_quantity: 20, ...(wholesale ? { wholesale_price_usd: wholesale } : {}) },
    })
    expect(r.status()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  idA = await mk(NAME_A, 10, 8)
  idB = await mk(NAME_B, 5, null)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pos')
  for (const name of [NAME_A, NAME_B]) {
    await page.getByPlaceholder('Buscar producto o código...').fill(name)
    await page.getByText(name, { exact: true }).first().click()
  }

  const bcv = page.getByRole('radio', { name: 'BCV (Bs)' })
  const divisa = page.getByRole('radio', { name: 'Divisa ($)' })
  const total = page.locator('[class*="totalUsdValue"]')
  await expect(bcv).toHaveAttribute('aria-checked', 'true')
  await expect(total).toHaveText('$15.00')

  await divisa.click()
  await expect(divisa).toHaveAttribute('aria-checked', 'true')
  await expect(total).toHaveText('$13.00') // 8 + 5 (la línea sin precio Divisa usa BCV)
  await expect(page.getByText('Sin precio Divisa', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1 línea sin precio Divisa usa el BCV')).toBeVisible()
  await expect(page.locator('[class*="totalBsValue"]')).toContainText('Bs.')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/divisa_pos_1440.png` })

  await bcv.click()
  await expect(total).toHaveText('$15.00')

  await page.setViewportSize({ width: 375, height: 812 })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/divisa_pos_375.png` })
})

test('Pedido: el modo se cambia en el detalle y el servidor reprecia las líneas', async ({ page }) => {
  await login(page)
  const created = await page.request.post('/api/orders', {
    data: {
      client_name: 'ZZ Cliente Divisa', origin: 'phone',
      items: [
        { product_id: idA, product_name: NAME_A, quantity: 1 },
        { product_id: idB, product_name: NAME_B, quantity: 1 },
      ],
    },
  })
  expect(created.status(), await created.text()).toBeLessThan(300)
  const body = (await created.json()) as { order: { id: number; order_number: string } }
  orderId = body.order.id

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pedidos')
  await page.getByText(body.order.order_number, { exact: true }).click()
  const divisa = page.getByRole('radio', { name: 'Divisa ($)' })
  await expect(page.getByRole('radio', { name: 'BCV (Bs)' })).toHaveAttribute('aria-checked', 'true')
  await divisa.click()
  await expect(divisa).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('$13.00').last()).toBeVisible()
  await expect(page.getByText('Sin precio Divisa', { exact: true }).first()).toBeVisible()
  expect(sql(`SELECT price_mode FROM orders WHERE id=${orderId}`)).toBe('divisa')
  expect(sql(`SELECT GROUP_CONCAT(price_source ORDER BY id) FROM order_items WHERE order_id=${orderId}`)).toBe('divisa,fallback_bcv')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/divisa_pedido_1440.png` })
})
