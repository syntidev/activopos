import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Servicio (sale_mode='service') con tamaños/porciones SIN inventario, en el editor compartido por todas las plantillas.
 * Negocio de pruebas propio (ZZA), plantilla carta y genérica: alta con 3 tamaños, recarga (se ven los 3 con su precio),
 * cambio de un precio (los 3 siguen activos), baja de uno, y cobro en POS al precio del tamaño elegido (stock 0, nunca "Agotado").
 * Correr con el dev server en :3001 → E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN, slug: SLUG } = ownBusiness()
const TAG = String(Date.now()).slice(-8)
const TAMANOS = [['100gr', '5', '4'], ['200gr', '8', '7'], ['300gr', '11', '10']] as const
const PLANTILLAS = ['carta', 'generic'] as const

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let original = ''
const names = PLANTILLAS.map(t => `ZZ Servicio Tamanos ${t} ${TAG}`)

test.beforeAll(() => { original = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) })
test.afterAll(() => {
  sql(`UPDATE businesses SET catalog_template='${original}' WHERE id=${BID}`)
  for (const n of names) {
    const id = sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${n}' LIMIT 1`)
    if (!id) continue
    sql(`DELETE FROM sale_items WHERE product_id=${id}`)
    sql(`DELETE FROM inventory_entries WHERE product_id=${id}`)
    sql(`DELETE FROM product_variants WHERE product_id=${id}`)
    sql(`DELETE FROM products WHERE id=${id} AND business_id=${BID}`)
  }
})

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}

const rowOf = (page: Page, valor: string) =>
  page.locator('[role="row"]').filter({ has: page.getByText(valor, { exact: true }) }).last()

const variantsOf = (id: string): string =>
  sql(`SELECT valor,IFNULL(FORMAT(price_usd,2),''),IFNULL(FORMAT(divisa_price_usd,2),''),is_active FROM product_variants WHERE product_id=${id} ORDER BY valor`)
    .split('\n').map(l => l.trim()).join('\n')

for (const [i, template] of PLANTILLAS.entries()) {
  const name = names[i]

  test(`${template}: servicio con 3 tamaños — alta, recarga, cambio de precio, baja y cobro`, async ({ page }) => {
    sql(`UPDATE businesses SET catalog_template='${template}' WHERE id=${BID}`)
    await login(page)

    // ── Alta desde cero ──
    await page.goto('/productos/nuevo')
    await page.locator('#np-name').fill(name)
    await page.getByRole('button', { name: /^Servicio/ }).click()
    await page.getByRole('tab', { name: 'Precio' }).click()
    await page.locator('#np-price').fill('5')
    await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
    await page.locator('label[aria-label="Este servicio tiene tamaños o porciones"]').click()
    for (const [t] of TAMANOS) {
      await page.getByPlaceholder('Ej: 100gr, 200gr, Familiar').fill(t)
      await page.getByRole('button', { name: 'Agregar' }).click()
    }
    for (const [t, full, divisa] of TAMANOS) {
      await rowOf(page, t).getByLabel(`Precio Full propio de la talla ${t}`).fill(full)
      await rowOf(page, t).getByLabel(`Precio Divisa propio de la talla ${t}`).fill(divisa)
    }
    // servicio: sin stock, código de barras ni SKU
    await expect(rowOf(page, '100gr').getByLabel('Stock', { exact: true })).toHaveCount(0)
    await expect(rowOf(page, '100gr').getByLabel('Código de barras')).toHaveCount(0)
    await expect(page.getByLabel('Mismo stock para todas')).toHaveCount(0)
    await page.screenshot({ path: `tests/__capturas__/servicio-tamanos-${template}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Guardar producto' }).click()
    await page.waitForURL('**/productos')

    const id = sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${name}'`)
    expect(sql(`SELECT sale_mode,has_variants FROM products WHERE id=${id}`)).toBe('service\t1')
    expect(variantsOf(id)).toBe(['100gr\t5.00\t4.00\t1', '200gr\t8.00\t7.00\t1', '300gr\t11.00\t10.00\t1'].join('\n'))

    expect(sql(`SELECT SUM(stock) FROM product_variants WHERE product_id=${id}`)).toBe('0')

    // ── Recarga del editor: se ven los 3 con su precio ──
    await page.goto(`/productos/${id}/editar`)
    await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
    for (const [t, full, divisa] of TAMANOS) {
      await expect(rowOf(page, t).getByLabel(`Precio Full propio de la talla ${t}`)).toHaveValue(full)
      await expect(rowOf(page, t).getByLabel(`Precio Divisa propio de la talla ${t}`)).toHaveValue(divisa)
    }

    // ── Cambio de precio de 1: los 3 siguen activos ──
    await rowOf(page, '200gr').getByLabel('Precio Full propio de la talla 200gr').fill('9')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await page.waitForURL('**/productos')
    expect(variantsOf(id)).toBe(['100gr\t5.00\t4.00\t1', '200gr\t9.00\t7.00\t1', '300gr\t11.00\t10.00\t1'].join('\n'))
    expect(sql(`SELECT has_variants FROM products WHERE id=${id}`)).toBe('1')

    // ── Cobro en POS: el tamaño elegido manda el precio; stock 0 no lo bloquea ──
    const v200 = sql(`SELECT id FROM product_variants WHERE product_id=${id} AND valor='200gr'`)
    const methods = (await (await page.request.get('/api/payment-methods')).json()) as { methods?: Array<{ id: number }>; payment_methods?: Array<{ id: number }> }
    const pm = (methods.methods ?? methods.payment_methods ?? [])[0]?.id
    const rate = Number(sql(`SELECT rate FROM dollar_rates WHERE business_id=${BID} ORDER BY id DESC LIMIT 1`)) || 1
    const sale = await page.request.post('/api/sales', {
      data: {
        items: [{ product_id: Number(id), variant_id: Number(v200), quantity: 1, sale_mode: 'service', price_per_unit_usd: 5 }],
        status: 'paid', origin: 'pos',
        // pago holgado: la tasa del servidor puede diferir de la local; lo que se verifica es el precio cobrado
        payments: [{ payment_method_id: pm, amount_usd: 20, amount_bs: Math.round(20 * Math.max(rate, 1000) * 100) / 100 }],
      },
    })
    expect(sale.status(), await sale.text()).toBeLessThan(300)
    expect(Number(sql(`SELECT price_per_unit_usd FROM sale_items WHERE product_id=${id} ORDER BY id DESC LIMIT 1`))).toBe(9)

    // ── Baja de uno: solo ese queda inactivo, y el editor no lo vuelve a mostrar ──
    await page.goto(`/productos/${id}/editar`)
    await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
    await rowOf(page, '300gr').getByRole('button', { name: 'Quitar tamaño 300gr' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await page.waitForURL('**/productos')
    expect(variantsOf(id)).toBe(['100gr\t5.00\t4.00\t1', '200gr\t9.00\t7.00\t1', '300gr\t11.00\t10.00\t0'].join('\n'))
    await page.goto(`/productos/${id}/editar`)
    await page.getByRole('tab', { name: 'Inventario y variantes' }).click()
    await expect(rowOf(page, '200gr')).toBeVisible()
    await expect(page.getByText('300gr', { exact: true })).toHaveCount(0)
  })
}
