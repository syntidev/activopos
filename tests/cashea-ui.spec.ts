import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, SLUG, apiAs, cleanupTestProducts, login } from './p0-helpers'

/**
 * Interfaz de Cashea (financiamiento declarado en el ticket): checkout del catálogo, Pedidos y POS.
 * Contrato: .doc/CONTRATO_CASHEA_TICKET.md. Negocio 87, servidor local. Capturas en test-results/cashea/.
 */
const FIN_NAME = 'ZZ Cashea UI Pago'
const SHOTS = 'test-results/cashea'
const ids = { a: 0, excluido: 0 }
let api: APIRequestContext
let publico: APIRequestContext
let seq = Date.now() % 1_000_000

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

function cleanup(): void {
  const prods = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Cashea UI%'`).split('\n').filter(Boolean)
  if (prods.length > 0) {
    const list = prods.join(',')
    sql(`DELETE oi FROM order_items oi WHERE oi.product_id IN (${list})`)
    sql(`DELETE FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Cashea UI%'`)
    const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${list})`).split('\n').filter(Boolean)
    if (sales.length > 0) {
      const sl = sales.join(',')
      sql(`DELETE FROM sale_payments WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sale_items WHERE sale_id IN (${sl})`)
      sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sl})`)
    }
  }
  sql(`DELETE FROM payment_methods WHERE business_id=${BUSINESS_ID} AND name='${FIN_NAME}'`)
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND action LIKE 'financing_%'`)
  cleanupTestProducts('Cashea UI')
}

async function crear(data: Record<string, unknown>): Promise<number> {
  const r = await api.post('/api/products', { data })
  expect(r.status(), await r.text()).toBe(201)
  return (await r.json()).product.id as number
}

async function financiamiento(enabled: boolean): Promise<void> {
  const r = await api.patch('/api/config/catalog', { data: { financing: { enabled, mode: 'cashea' } } })
  expect(r.status()).toBe(200)
}

test.beforeAll(async () => {
  cleanup()
  api = await apiAs()
  publico = await pwRequest.newContext({ baseURL: BASE })
  await financiamiento(true)
  const base = { cost_per_unit_usd: 40, price_per_unit_usd: 100, stock_quantity: 50, show_in_catalog: true, catalog_visibility: 'visible' }
  ids.a = await crear({ ...base, name: 'ZZ Cashea UI A' })
  ids.excluido = await crear({ ...base, name: 'ZZ Cashea UI Excluido', price_per_unit_usd: 30, financing_excluded: true })
  sql(`INSERT INTO payment_methods (business_id, name, type, is_active, is_financing, sort_order) VALUES (${BUSINESS_ID}, '${FIN_NAME}', 'other', 1, 1, 99)`)
})

test.afterAll(async () => {
  await financiamiento(false).catch(() => undefined)
  sql(`UPDATE businesses SET settings = JSON_REMOVE(JSON_REMOVE(IFNULL(settings, JSON_OBJECT()), '$.financing'), '$.catalog_financing_badge') WHERE id = ${BUSINESS_ID}`)
  cleanup()
  await api.dispose()
  await publico.dispose()
})

/** Carrito en localStorage -> abre el carrito -> checkout hasta el paso 3 (pago). */
async function irAlPago(page: Page, catalog: string, items: Array<{ id: number; name: string; price: number }>): Promise<void> {
  const cart = items.map(i => ({ product_id: i.id, name: i.name, qty: 1, price_usd: i.price, image_url: null }))
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [`activopos_cart_${SLUG}`, JSON.stringify(cart)])
  await expect(async () => {
    await page.goto(`/${catalog}/${SLUG}`)
    await page.getByRole('button', { name: /^Carrito/ }).first().click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click({ timeout: 8000 })
  }).toPass({ timeout: 90_000 })
  seq += 1
  await page.getByTestId('checkout-name').fill(`ZZ Cashea UI cliente ${seq}`)
  await page.getByTestId('checkout-phone').fill(`0414${String(1000000 + (seq % 8999999))}`)
  await page.getByTestId('checkout-cedula').fill(`V-${20000000 + (seq % 9999999)}`)
  await page.getByTestId('checkout-next-1').click()
  await page.getByTestId('checkout-next-2').click()
  await expect(page.getByTestId('pay-kind-bs')).toBeVisible()
}

for (const catalog of ['catalogo', 'catalogo-premium']) {
  test(`${catalog}: Cashea válido (BCV en USD y Bs, sin Divisa) y se envía como payment_kind cashea`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await irAlPago(page, catalog, [{ id: ids.a, name: 'ZZ Cashea UI A', price: 100 }])
    await page.getByTestId('pay-kind-cashea').click()
    await expect(page.getByTestId('cashea-info')).toContainText('No aplica Divisa')
    await expect(page.locator('[class*="checkoutSummaryValue"]').last()).toHaveText(/\$100\.00 · Bs\./)
    await page.screenshot({ path: `${SHOTS}/${catalog}-375.png` })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: `${SHOTS}/${catalog}-1440.png` })

    const req = page.waitForRequest(r => r.url().includes(`/api/catalog/${SLUG}/order`) && r.method() === 'POST')
    await page.getByTestId('checkout-submit').click()
    const body = (await req).postDataJSON() as { payment_kind: string; payment_method: string }
    expect(body.payment_kind).toBe('cashea')
    expect(body.payment_method).toBe(FIN_NAME)
    await expect.poll(() => sql(`SELECT financing_status FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Cashea UI cliente ${seq}'`), { timeout: 15_000 }).toBe('requested')
  })
}

test('carrito con producto excluido: Cashea deshabilitado con el aviso y el nombre del producto', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await irAlPago(page, 'catalogo', [{ id: ids.a, name: 'ZZ Cashea UI A', price: 100 }, { id: ids.excluido, name: 'ZZ Cashea UI Excluido', price: 30 }])
  await expect(page.getByTestId('pay-kind-cashea')).toBeDisabled()
  await expect(page.getByTestId('cashea-blocked')).toContainText('quítalo para pagar con Cashea')
  await expect(page.getByTestId('cashea-blocked')).toContainText('ZZ Cashea UI Excluido')
  await page.screenshot({ path: `${SHOTS}/excluido-375.png` })
})

test('financiamiento apagado: Cashea no aparece en el checkout', async ({ page }) => {
  await financiamiento(false)
  await irAlPago(page, 'catalogo', [{ id: ids.a, name: 'ZZ Cashea UI A', price: 100 }])
  await expect(page.getByTestId('pay-kind-bs')).toBeVisible()
  await expect(page.getByTestId('pay-kind-divisa')).toBeVisible()
  await expect(page.getByTestId('pay-kind-cashea')).toHaveCount(0)
  await financiamiento(true)
})

test('Pedidos: pedido aprobado muestra el aviso, bloquea BCV/Divisa y al editar ítems vuelve a solicitado', async ({ page }) => {
  seq += 1
  const r = await publico.post(`/api/catalog/${SLUG}/order`, {
    headers: { 'x-real-ip': `10.77.${Math.floor(seq / 250) % 250}.${(seq % 250) + 1}` },
    data: {
      items: [{ product_id: ids.a, qty: 1 }], customer_name: `ZZ Cashea UI pedido ${seq}`, customer_phone: `0414${String(1000000 + (seq % 8999999))}`,
      customer_reference: 'Prueba', payment_method: FIN_NAME, payment_kind: 'cashea', customer_cedula: `V-${20000000 + (seq % 9999999)}`, delivery_type: 'pickup',
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  const order = (await r.json()) as { order_id: number }
  expect((await api.patch(`/api/orders/${order.order_id}/financing`, { data: { action: 'approve' } })).status()).toBe(200)
  const number = sql(`SELECT order_number FROM orders WHERE id=${order.order_id}`)

  await login(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pedidos')
  await page.getByText(number, { exact: true }).first().click()
  const panel = page.getByTestId('financing-panel')
  await expect(panel.getByTestId('financing-badge')).toHaveAttribute('data-status', 'approved')
  await expect(page.getByTestId('financing-edit-warning')).toContainText('exige aprobarlo otra vez')
  await expect(page.getByTestId('financing-bcv-note')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Divisa ($)' })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/pedido-1440.png` })

  await page.getByRole('button', { name: 'Aumentar cantidad de ZZ Cashea UI A' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(panel.getByTestId('financing-badge')).toHaveAttribute('data-status', 'requested')

  // Cambiar el estado pide confirmación.
  await panel.getByRole('button', { name: 'Rechazar' }).click()
  await expect(panel.getByRole('alertdialog')).toBeVisible()
  await panel.getByRole('button', { name: 'Confirmar' }).click()
  await expect(panel.getByTestId('financing-badge')).toHaveAttribute('data-status', 'rejected')
})

test('POS: Cashea solicitado bloquea el cobro; aprobado ofrece solo la financiadora', async ({ page }) => {
  const d = await api.post('/api/pos/drafts', { data: { items: [{ product_id: ids.a, quantity: 1, discount_usd: 0 }] } })
  expect(d.status(), await d.text()).toBeLessThan(300)
  const draftId = ((await d.json()) as { draft: { id: number } }).draft.id

  await login(page)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/pos?draft=${draftId}`)
  await page.getByRole('button', { name: /Ver carrito/ }).click()
  const panel = page.getByTestId('financing-panel')
  await expect(panel).toBeVisible({ timeout: 60_000 })

  await panel.getByRole('button', { name: 'Pedir Cashea' }).click()
  await panel.getByRole('button', { name: 'Confirmar' }).click()
  await expect(panel.getByTestId('financing-badge')).toHaveAttribute('data-status', 'requested')
  await expect(page.getByRole('button', { name: 'Procesar Pago' })).toBeDisabled()
  await expect(page.getByTestId('cobro-blocked')).toContainText('falta la aprobación')
  await expect(page.getByTestId('financing-bcv-note')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/pos-solicitado-375.png` })

  await panel.getByRole('button', { name: 'Aprobar' }).click()
  await panel.getByRole('button', { name: 'Confirmar' }).click()
  await expect(panel.getByTestId('financing-badge')).toHaveAttribute('data-status', 'approved')
  await expect(page.getByTestId('financing-edit-warning')).toContainText('ticket aprobado por Cashea')
  await page.getByRole('button', { name: 'Procesar Pago' }).click()
  await expect(page.getByRole('button', { name: FIN_NAME })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: `${SHOTS}/pos-aprobado-1440.png` })
})
