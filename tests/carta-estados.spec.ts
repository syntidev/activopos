import { test, expect } from '@playwright/test'
import { sql } from './alta-helpers'
import { BASE, SLUG, SLUG_SOLO_BS, sembrarCarta, limpiarCarta, urlCarta } from './carta-helpers'

/**
 * Carta · estados del negocio: solo Bs (sin Cashea ni Divisa), horario cerrado y agotado del día.
 * SPEC §4.1, §4.9, §5, B3, A2 (cerrado). Cerrado y agotado van en test.fixme hasta C2 (necesitan carta_hours efectivo y products.sold_out_date).
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 60_000 })

test.afterAll(() => { limpiarCarta(SLUG_SOLO_BS); limpiarCarta(SLUG) })

test('negocio que cobra solo Bs: sin Cashea ni Divisa en lista, franja de pago, ficha ni carrito', async ({ page }) => {
  sembrarCarta({ slug: SLUG_SOLO_BS, soloBs: true })
  const prohibido = /cashea|divisa|zelle|binance/i

  await page.goto(urlCarta(SLUG_SOLO_BS))
  await expect(page.getByTestId('carta-root')).toBeVisible()
  expect(await page.locator('body').innerText(), 'lista/portada').not.toMatch(prohibido)
  await expect(page.getByTestId('carta-franja-pago')).toContainText(/Bs/)

  await page.getByTestId('carta-plato').filter({ hasText: 'Lomito de Res' }).getByTestId('carta-plato-nombre').click()
  await expect(page.getByTestId('carta-ficha')).toBeVisible()
  expect(await page.locator('body').innerText(), 'ficha').not.toMatch(prohibido)
  await page.getByTestId('carta-ficha-agregar').click()

  await page.goto(urlCarta(SLUG_SOLO_BS))
  await page.getByTestId('carta-barra-pedido').click()
  await expect(page.getByTestId('carta-carrito')).toBeVisible()
  expect(await page.locator('body').innerText(), 'carrito').not.toMatch(prohibido)
  await expect(page.getByTestId('carta-pago-bs')).toBeVisible()
  await expect(page.getByTestId('carta-pago-divisa')).toHaveCount(0)
  await expect(page.getByTestId('carta-pago-cashea')).toHaveCount(0)
})

test('negocio solo Bs: ningún plato muestra precio Divisa (un solo precio $ y el Bs debajo)', async ({ page }) => {
  await page.goto(urlCarta(SLUG_SOLO_BS))
  const pechuga = page.getByTestId('carta-plato').filter({ hasText: 'Pechuga de Pollo Asada' })
  await expect(pechuga.getByTestId('carta-plato-precio-usd')).toHaveText('$14.00') // lista; sin Divisa
})

test.fixme('A2 cerrado: horario cerrado → "Cerrado · abre …", la carta se ve, el envío se bloquea con aviso y "Avísame por WhatsApp" — necesita carta_hours efectivo (C2)', async ({ page }) => {
  sembrarCarta({ slug: SLUG, abierto: false })
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-estado')).toContainText(/Cerrado · abre/i)
  await expect(page.getByTestId('carta-plato').first()).toBeVisible()
  await page.getByTestId('carta-plato').filter({ hasText: 'Tequeños de Queso' }).getByTestId('carta-plato-agregar').click()
  await page.getByTestId('carta-barra-pedido').click()
  await expect(page.getByTestId('carta-aviso-cerrado')).toBeVisible()
  await expect(page.getByTestId('carta-enviar')).toBeDisabled()
  await expect(page.getByTestId('carta-avisame')).toBeVisible()
})

test.fixme('B3 agotado del día: atenuado, "Agotado hoy", sin Agregar, el servidor responde 409 y se reabre al día siguiente — necesita products.sold_out_date (C2)', async ({ page, request }) => {
  sembrarCarta({ slug: SLUG })
  const bid = sql(`SELECT id FROM businesses WHERE catalog_slug='${SLUG}'`)
  const id = sql(`SELECT id FROM products WHERE business_id=${bid} AND name='Smash Burger'`)
  sql(`UPDATE products SET sold_out_date=CURDATE() WHERE id=${id}`)
  await page.goto(urlCarta())
  const smash = page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' })
  await expect(smash.getByTestId('carta-agotado-hoy')).toHaveText(/Agotado hoy/i)
  await expect(smash.getByTestId('carta-plato-agregar')).toHaveCount(0)

  const res = await request.post(`/api/catalog/${SLUG}/order`, {
    data: { items: [{ product_id: Number(id), qty: 1 }], customer_name: 'Maria Perez', customer_phone: '04141234567', customer_cedula: 'V12345678', customer_reference: 'Para llevar', payment_method: 'Pago móvil' },
  })
  expect(res.status()).toBe(409)

  sql(`UPDATE products SET sold_out_date=DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id=${id}`)
  await page.reload()
  await expect(smash.getByTestId('carta-plato-agregar')).toBeVisible()
})
