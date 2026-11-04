import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Pie del modal "Generar Cotización": sin desborde a 375 / 414 / 1280 px y con los tres botones dentro del modal.
 * Negocio 80. Producto ZZ propio; se borra al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const NAME = `ZZ CotPie ${String(Date.now()).slice(-6)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext

const token = async (): Promise<string> =>
  new SignJWT({ userId: 79, businessId: BID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ CotPie%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const p = await api.post('/api/products', { data: { name: NAME, cost_per_unit_usd: 5, price_per_unit_usd: 20, is_fixed_price: true, stock_quantity: 10 } })
  expect(p.status(), await p.text()).toBe(201)
})

test.afterAll(async () => {
  cleanup()
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ CotPie%'`))).toBe(0)
})

async function abrirModal(page: Page, ancho: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: 800 })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await page.getByPlaceholder('Buscar producto o código...').fill(NAME)
  await page.getByTestId('product-card').filter({ hasText: NAME }).first().click()
  // POS móvil: el ticket vive en una hoja. dispatchEvent: el aviso de errores de `next dev` puede tapar la barra.
  if (ancho < 768) await page.getByRole('button', { name: /Ver carrito/ }).dispatchEvent('click')
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)
  if (ancho < 768) {
    await page.getByRole('button', { name: /Más/ }).dispatchEvent('click')
    await page.getByRole('menuitem', { name: /cotizaci/i }).dispatchEvent('click')
  } else {
    await page.getByRole('button', { name: /Generar Cotización/ }).click()
  }
  await expect(page.getByRole('dialog', { name: /Generar Cotización/ })).toBeVisible()
  await page.waitForTimeout(400) // termina la animación de entrada
}

for (const ancho of [375, 414, 1280]) {
  test(`${ancho} px: el pie no se desborda y los tres botones quedan dentro del modal`, async ({ page }) => {
    await abrirModal(page, ancho)
    const dialog = page.getByRole('dialog', { name: /Generar Cotización/ })
    const medidas = await dialog.evaluate((el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      const botones = ['Cancelar', 'Solo imprimir', 'Guardar y imprimir'].map(t => {
        const b = Array.from(el.querySelectorAll('button')).find(x => x.textContent?.includes(t))
        const r = b?.getBoundingClientRect()
        return { t, left: r ? r.left : -1, right: r ? r.right : -1, w: r ? r.width : 0 }
      })
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, left: box.left, right: box.right, botones }
    })
    expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth)
    for (const b of medidas.botones) {
      expect(b.w, `${b.t} existe`).toBeGreaterThan(40)
      expect(b.left, `${b.t} no se corta a la izquierda`).toBeGreaterThanOrEqual(medidas.left - 1)
      expect(b.right, `${b.t} no se corta a la derecha`).toBeLessThanOrEqual(medidas.right + 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({ path: `tests/__capturas__/cotizacion-pie-${ancho}.png` })
  })
}
