import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { BASE, CAPTURAS, ensureBusiness, ensureUser, login, seedCarta, sql, type CartaSeed } from './helpers/restaurante-kds'

/**
 * Restaurante R5 — flujo completo EN PANTALLA, a 375 y a 1280: abrir mesa → agregar y enviar → cocinar (KDS) → servir → pedir cuenta →
 * dividir → cobrar (cobro del POS) → cuenta cerrada → liberar la mesa. Cada rol entra con su sesión. Solo activopos_kds.
 */

test.use({ storageState: { cookies: [], origins: [] }, baseURL: BASE })
test.describe.configure({ mode: 'serial' })

const R5 = path.join(CAPTURAS, 'r5')

let A = 0
let admin = 0, cashier = 0, waiter = 0, cook = 0
let carta: CartaSeed
const tables: Array<{ id: number; label: string }> = []

type Json = Record<string, unknown>
const call = (page: Page, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, data?: Json) => page.request.fetch(`${BASE}${url}`, { method, data })
const json = async <T>(r: Awaited<ReturnType<typeof call>>): Promise<T> => (await r.json()) as T
const as = (ctx: Parameters<typeof login>[0], role: 'admin' | 'cashier' | 'waiter' | 'kitchen', uid: number) => login(ctx, A, role, uid)

test.beforeAll(() => {
  A = ensureBusiness('zzkds-a', true)
  admin = ensureUser(A, 'admin', 'Admin Flujo')
  cashier = ensureUser(A, 'cashier', 'Cajera Flujo')
  waiter = ensureUser(A, 'waiter', 'Maria P')
  cook = ensureUser(A, 'kitchen', 'Cocinero Flujo')
  carta = seedCarta(A)
  fs.mkdirSync(R5, { recursive: true })
  if (!Number(sql(`SELECT COUNT(*) FROM payment_methods WHERE business_id=${A} AND name='ZZ Efectivo USD'`))) {
    sql(`INSERT INTO payment_methods (business_id,name,type,is_active,is_financing) VALUES (${A},'ZZ Efectivo USD','cash',1,0)`)
  }
  sql(`UPDATE cash_registers SET closed_at = UTC_TIMESTAMP(3) WHERE business_id=${A} AND closed_at IS NULL`)
  sql(`INSERT INTO cash_registers (business_id,cashier_id,opening_amount_bs,opening_amount_usd,rate_at_open,opened_at) VALUES (${A},${cashier},0,0,36,UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE)`)
})

test('0 · preparación: salón, estación de cocina y ruteo de los platos', async ({ page, context }) => {
  await as(context, 'admin', admin)
  const area = (await json<{ area: { id: number } }>(await call(page, 'POST', '/api/restaurante/areas', { name: 'Salón' }))).area.id
  for (const label of ['71', '72']) {
    const t = (await json<{ tables: Array<{ id: number }> }>(await call(page, 'POST', '/api/restaurante/mesas', { area_id: area, label, capacity: 4 }))).tables[0]
    tables.push({ id: t.id, label })
  }
  const cocina = (await json<{ station: { id: number } }>(await call(page, 'POST', '/api/restaurante/estaciones', { name: 'Cocina', warn_min: 10, critical_min: 20 }))).station.id
  expect((await call(page, 'PUT', '/api/restaurante/ruteo', { category_id: carta.categoryId, station_id: null, requires_preparation: true })).status()).toBe(200)
  expect((await call(page, 'PATCH', `/api/restaurante/estaciones/${cocina}`, { user_ids: [cook] })).status()).toBe(200)
})

for (const vp of [{ w: 375, h: 812, i: 0 }, { w: 1280, h: 900, i: 1 }]) {
  test(`flujo completo @${vp.w}: abrir → enviar → cocinar → servir → pedir cuenta → dividir → cobrar → liberar`, async ({ page, context }) => {
    const mesa = tables[vp.i]
    await page.setViewportSize({ width: vp.w, height: vp.h })
    const shot = async (name: string): Promise<void> => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(R5, `flujo-${vp.w}-${name}.png`), fullPage: true }) }

    /* 1 · el mesonero abre la mesa en el plano */
    await as(context, 'waiter', waiter)
    await page.goto('/restaurante/mesas')
    await page.getByRole('button', { name: new RegExp(`^Mesa ${mesa.label},`) }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Abrir cuenta' }).click()
    await expect(page).toHaveURL(/\/restaurante\/cuenta\/\d+/, { timeout: 10_000 })
    const accountUrl = page.url()

    /* 2 · agrega un plato y 2 cervezas, y los envía a cocina */
    const add = async (product: string, qty: number): Promise<void> => {
      await page.getByRole('button', { name: 'Agregar ítem', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(product) }).click()
      for (let i = 1; i < qty; i++) await page.getByRole('dialog').getByRole('button', { name: 'Más', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: /^Agregar ·/ }).click()
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8_000 })
    }
    await add('ZZ Pasta carbonara', 1)
    await add('ZZ Cerveza Polar', 2)
    await shot('1-cuenta-borrador')
    await page.getByRole('button', { name: /^Enviar a cocina/ }).click()
    await expect(page.getByText('En cocina').first()).toBeVisible({ timeout: 8_000 })

    /* 3 · la cocina lo prepara en su pantalla */
    await as(context, 'kitchen', cook)
    await page.goto('/kds')
    const ticket = page.getByRole('article', { name: `Comanda ${mesa.label}` })
    await expect(ticket).toBeVisible({ timeout: 10_000 })
    await ticket.getByRole('button', { name: 'Empezar' }).click()
    const prep = page.getByRole('tab', { name: /Prep./ }) // en móvil la comanda cambia de pestaña al empezar
    if (await prep.isVisible()) await prep.click()
    await expect(ticket.getByRole('button', { name: 'Listo', exact: true })).toBeVisible({ timeout: 8_000 })
    await ticket.getByRole('button', { name: 'Listo', exact: true }).click()
    const listas = page.getByRole('tab', { name: /Listas/ })
    if (await listas.isVisible()) await listas.click()
    await expect(ticket.getByText('Avisado al mesonero')).toBeVisible({ timeout: 8_000 })
    await shot('2-cocina')

    /* 4 · el mesonero ve que salió y lo sirve; pide la cuenta */
    await as(context, 'waiter', waiter)
    await page.goto(accountUrl)
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Marcar servido' }).first().click()
      await page.waitForTimeout(500)
    }
    await expect(page.getByText('Servido').first()).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: 'Pedir cuenta' }).click()
    await expect(page.getByText('Por cobrar').first()).toBeVisible({ timeout: 8_000 })
    await shot('3-por-cobrar')

    /* 5 · la cajera divide en 2 subcuentas y cobra cada una con el cobro del POS */
    await as(context, 'cashier', cashier)
    await page.goto(accountUrl)
    await page.getByRole('button', { name: 'Cobrar', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Dividir' }).click()
    await page.getByLabel(/Subcuenta de ZZ Cerveza/).selectOption('1')
    await shot('4-dividir')
    await page.getByRole('button', { name: /^Crear 2 cobros/ }).click()
    for (let n = 1; n <= 2; n++) {
      await expect(page.getByRole('dialog').getByText(`Cobro ${n} de 2`).first()).toBeVisible({ timeout: 8_000 })
      await page.getByRole('dialog').getByRole('button', { name: /^Cobrar \$/ }).click()
      await page.getByRole('button', { name: 'ZZ Efectivo USD' }).click()
      await page.getByRole('button', { name: 'Confirmar Venta' }).click()
      await expect(page.getByText(/Venta registrada|Ticket|Comprobante|Imprimir/i).first()).toBeVisible({ timeout: 10_000 })
      if (n === 1) await shot('5-cobro-pagado')
      await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click() // cierra el comprobante del cobro
      await page.getByRole('dialog').getByRole('button', { name: 'Sin propina' }).click()
    }
    await expect(page.getByText('Cerrada').first()).toBeVisible({ timeout: 10_000 })
    await shot('6-cuenta-cerrada')

    /* 6 · la mesa queda por limpiar y se libera */
    await page.goto('/restaurante/mesas')
    const plano = page.getByRole('button', { name: new RegExp(`^Mesa ${mesa.label},.*por limpiar`) })
    await expect(plano).toBeVisible({ timeout: 8_000 })
    await plano.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mesa lista' }).click()
    await expect(page.getByRole('button', { name: new RegExp(`^Mesa ${mesa.label},.*libre`) })).toBeVisible({ timeout: 8_000 })
    await shot('7-mesa-liberada')

    /* Lo cobrado cuadra con la cuenta: 2 ventas pagadas que suman $20, cuenta cerrada. */
    const id = Number(accountUrl.split('/').pop())
    expect(sql(`SELECT COUNT(*) FROM sales WHERE table_order_id=${id} AND status='paid'`)).toBe('2')
    expect(sql(`SELECT ROUND(SUM(total_usd),2) FROM sales WHERE table_order_id=${id}`)).toBe('20.00')
    expect(sql(`SELECT account_status FROM orders WHERE id=${id}`)).toBe('closed')
  })
}
