import { test, expect } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, BUSINESS_ID, apiAs, cleanupTestProducts, login } from './p0-helpers'

/**
 * P0 borrado y edición (negocio 87). Antes: DELETE devolvía 500 mudo por FKs RESTRICT (inventory_entries,
 * product_variants...) y la UI no mostraba nada. Ahora: sin historial se borra; con historial se desactiva;
 * siempre JSON con code + message legibles.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

const CATEGORY_ID = Number(sql(`SELECT id FROM categories WHERE business_id=${BUSINESS_ID} AND active=1 LIMIT 1`))

test.beforeAll(() => { cleanupTestProducts('Borrar') })
test.afterAll(() => {
  cleanupTestProducts('Borrar')
  sql(`DELETE FROM activity_logs WHERE business_id=${BUSINESS_ID} AND action IN ('product_deleted','product_deactivated') AND JSON_UNQUOTE(JSON_EXTRACT(old_values,'$.name')) LIKE 'ZZ Borrar%'`)
})

/** Bitácora de borrar/desactivar: `quién|acción|nombre` (el producto ya puede no existir, el nombre va en old_values). */
const removalLog = (productId: number): string =>
  sql(`SELECT CONCAT(user_id,'|',action,'|',JSON_UNQUOTE(JSON_EXTRACT(old_values,'$.name'))) FROM activity_logs
       WHERE business_id=${BUSINESS_ID} AND model_type='Product' AND model_id=${productId} AND action IN ('product_deleted','product_deactivated') ORDER BY id DESC LIMIT 1`).trim()

function exists(id: number): number {
  return Number(sql(`SELECT COUNT(*) FROM products WHERE id=${id} AND business_id=${BUSINESS_ID}`))
}

function idByName(name: string): number {
  return Number(sql(`SELECT IFNULL(MAX(id),0) FROM products WHERE business_id=${BUSINESS_ID} AND name='${name}'`))
}

test('Alta rápida con stock: DELETE borra (200 deleted), antes 500 mudo', async () => {
  const api = await apiAs()
  const r = await api.post('/api/quick-add/products', {
    data: { code: 'ZZBORRAR0001', name: 'ZZ Borrar AltaRapida', quantity: 3, category_id: CATEGORY_ID, price_usd: 10 },
  })
  expect(r.status()).toBe(201)
  const id = idByName('ZZ Borrar AltaRapida')
  expect(id).toBeGreaterThan(0)
  const d = await api.delete(`/api/products/${id}`)
  expect(d.status()).toBe(200)
  const j = await d.json()
  expect(j).toMatchObject({ ok: true, action: 'deleted', code: 'DELETED' })
  expect(typeof j.message).toBe('string')
  expect(exists(id)).toBe(0)
  expect(removalLog(id)).toBe('86|product_deleted|ZZ Borrar AltaRapida') // quién y cuál quedan en la bitácora
  await api.dispose()
})

test('producto normal con stock: DELETE borra', async () => {
  const api = await apiAs()
  const r = await api.post('/api/products', { data: { name: 'ZZ Borrar Normal', cost_per_unit_usd: 5, price_per_unit_usd: 9, stock_quantity: 4 } })
  expect(r.status()).toBe(201)
  const id = (await r.json()).product.id as number
  const d = await api.delete(`/api/products/${id}`)
  expect(d.status()).toBe(200)
  expect((await d.json()).action).toBe('deleted')
  expect(exists(id)).toBe(0)
  await api.dispose()
})

test('con historial (pedido): no borra, desactiva con mensaje claro en español', async () => {
  const api = await apiAs()
  const r = await api.post('/api/products', { data: { name: 'ZZ Borrar Historial', cost_per_unit_usd: 5, price_per_unit_usd: 9, stock_quantity: 4 } })
  const id = (await r.json()).product.id as number
  const o = await api.post('/api/orders', {
    data: { origin: 'whatsapp', client_name: 'ZZ Borrar cliente', items: [{ product_id: id, product_name: 'ZZ Borrar Historial', quantity: 1 }] },
  })
  expect(o.status()).toBe(201)
  const d = await api.delete(`/api/products/${id}`)
  expect(d.status()).toBe(200)
  const j = await d.json()
  expect(j).toMatchObject({ ok: true, action: 'deactivated', code: 'HAS_HISTORY' })
  expect(j.message).toMatch(/historial/)
  expect(exists(id)).toBe(1)
  expect(sql(`SELECT active FROM products WHERE id=${id}`)).toBe('0')
  expect(removalLog(id)).toBe('86|product_deactivated|ZZ Borrar Historial')
  const forced = await api.delete(`/api/products/${id}?force=true`)
  expect(forced.status()).toBe(200)
  expect(exists(id)).toBe(1)
  await api.dispose()
})

test('id inexistente: 404 con code y message', async () => {
  const api = await apiAs()
  const d = await api.delete('/api/products/999999999')
  expect(d.status()).toBe(404)
  expect(await d.json()).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  await api.dispose()
})

test('PATCH edita nombre, descripción, sku, barcode, precios y no exige marca', async () => {
  const api = await apiAs()
  const r = await api.post('/api/quick-add/products', {
    data: { code: 'ZZBORRAR0002', name: 'ZZ Borrar Editar', quantity: 1, category_id: CATEGORY_ID, price_usd: 10 },
  })
  expect(r.status()).toBe(201)
  const id = idByName('ZZ Borrar Editar')
  const p = await api.patch(`/api/products/${id}`, {
    data: { name: 'ZZ Borrar Editado', description: 'desc nueva', sku: 'ZZBSKU1', barcode: 'ZZBORRAR0003', price_per_unit_usd: 12.5, wholesale_price_usd: 9 },
  })
  expect(p.status()).toBe(200)
  const row = sql(`SELECT CONCAT_WS('|', name, description, sku, barcode, price_per_unit_usd, wholesale_price_usd, IFNULL(brand_id,'null')) FROM products WHERE id=${id}`)
  expect(row).toBe('ZZ Borrar Editado|desc nueva|ZZBSKU1|ZZBORRAR0003|12.50|9.00|null')
  await api.dispose()
})

test('UI Productos: botón Eliminar quita el producto', async ({ page }) => {
  const api = await apiAs()
  const r = await api.post('/api/quick-add/products', {
    data: { code: 'ZZBORRAR0004', name: 'ZZ Borrar UI', quantity: 2, category_id: CATEGORY_ID, price_usd: 7 },
  })
  expect(r.status()).toBe(201)
  await api.dispose()
  await login(page)
  await page.goto('/productos')
  await page.getByPlaceholder(/Nombre, SKU/).fill('ZZ Borrar UI')
  await expect(page.getByText('ZZ Borrar UI').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /Eliminar ZZ Borrar UI/ }).click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).last().click()
  await expect.poll(() => exists(idByName('ZZ Borrar UI')), { timeout: 20_000 }).toBe(0)
})
