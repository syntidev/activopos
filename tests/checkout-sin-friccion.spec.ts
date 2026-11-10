import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Checkout SIN fricción: solo bloquean nombre y teléfono (10-11 dígitos); la cédula (solo dígitos alcanza) y los datos de envío son
 * opcionales y, si faltan, el pedido entra marcado (cedula_alert / shipping_incomplete) y el negocio confirma por WhatsApp.
 * Autocompletar: mismo dispositivo (localStorage) y dispositivo nuevo (solo con cédula Y teléfono del mismo cliente).
 * Negocio propio 217 ("ZZ B Pruebas"): se pasa a plantilla genérica durante la prueba y se restaura al final. Datos con prefijo ZZB.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let bid = 0
let productId = 0
let mrwId = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))

function limpiar(): void {
  const orders = q("SELECT id FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %'").split('\n').filter(Boolean).join(',')
  if (orders) { q('DELETE FROM order_items WHERE order_id IN (' + orders + ')'); q('DELETE FROM orders WHERE id IN (' + orders + ')') }
  q("DELETE FROM inventory_entries WHERE business_id=@BID AND notes LIKE 'Reserva pedido catálogo%'")
  q("DELETE FROM clients WHERE business_id=@BID AND name LIKE 'ZZB %'")
}

test.beforeAll(() => {
  bid = ensureOwnBusiness()
  limpiar()
  productId = Number(q("SELECT id FROM products WHERE business_id=@BID AND name='Smash Burger'"))
  q("UPDATE businesses SET catalog_template='generic' WHERE id=@BID")
  q("DELETE FROM business_shipping_methods WHERE business_id=@BID AND code='zzb-mrw'")
  q("INSERT INTO business_shipping_methods (business_id, code, label, kind, requires_branch, active, sort_order, updated_at) VALUES (@BID, 'zzb-mrw', 'MRW', 'carrier_branch', 1, 1, 1, NOW(3))")
  mrwId = Number(q("SELECT id FROM business_shipping_methods WHERE business_id=@BID AND code='zzb-mrw'"))
})
test.afterAll(() => {
  limpiar()
  q("DELETE FROM business_shipping_methods WHERE business_id=@BID AND code='zzb-mrw'")
  q("UPDATE businesses SET catalog_template='carta' WHERE id=@BID")
})

const ultimo = (cols: string, where = '1=1'): string => q('SELECT ' + cols + " FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %' AND " + where + ' ORDER BY id DESC LIMIT 1')
const pedir = (request: APIRequestContext, data: Record<string, unknown>) =>
  request.post('/api/catalog/' + OWN_SLUG + '/order', {
    data: { items: [{ product_id: productId, qty: 1 }], customer_reference: 'Prueba', payment_method: 'Zelle', payment_kind: 'bs', delivery_type: 'pickup', ...data },
  })

test('API: solo nombre y teléfono, sin cédula → pasa y la cédula queda vacía', async ({ request }) => {
  const res = await pedir(request, { customer_name: 'ZZB Solo Nombre', customer_phone: '04141110001' })
  expect(res.status()).toBe(201)
  expect(ultimo("IFNULL(client_cedula,'none')")).toBe('none')
})

test('API: sin teléfono o con teléfono corto → no pasa, con field customer_phone', async ({ request }) => {
  for (const phone of ['', '12345']) {
    const res = await pedir(request, { customer_name: 'ZZB Sin Tel', customer_phone: phone })
    expect([400, 422], 'teléfono "' + phone + '"').toContain(res.status())
    if (phone) expect((await res.json() as { field?: string }).field).toBe('customer_phone')
  }
})

test('API: cédula con puntos (21.222.819) → V-21222819; MRW con oficina y sin ciudad/dirección → envío completo', async ({ request }) => {
  const res = await pedir(request, {
    customer_name: 'ZZB Daniela API', customer_phone: '0424-179-5757', customer_cedula: '21.222.819',
    delivery_type: 'delivery', shipping_method_id: mrwId, branch_office: 'MRW oficina Sebucan', delivery_address: null,
  })
  expect(res.status()).toBe(201)
  expect(ultimo("CONCAT(client_cedula,'|',shipping_incomplete,'|',IFNULL(cedula_alert,0))")).toBe('V-21222819|0|0')
})

test('API: envío MRW sin cédula ni oficina → pasa "por completar" y el WhatsApp lo dice', async ({ request }) => {
  const res = await pedir(request, {
    customer_name: 'ZZB Incompleto', customer_phone: '04141110002', delivery_type: 'delivery', shipping_method_id: mrwId,
  })
  expect(res.status()).toBe(201)
  const body = await res.json() as { whatsapp_url: string | null }
  expect(ultimo('shipping_incomplete')).toBe('1')
  expect(decodeURIComponent(body.whatsapp_url ?? '')).toContain('Datos de envío por completar')
})

test('API: cédula mal escrita no bloquea: se guarda lo escrito y el pedido queda marcado para revisar', async ({ request }) => {
  const res = await pedir(request, { customer_name: 'ZZB Cedula Mala', customer_phone: '04141110003', customer_cedula: 'abc' })
  expect(res.status()).toBe(201)
  expect(ultimo("CONCAT(client_cedula,'|',cedula_alert)")).toBe('abc|1')
})

test('saved-address: solo { has_saved_address }, nunca nombre ni dirección (ni con cédula y teléfono correctos)', async ({ request }) => {
  const consulta = (cedula: string, phone: string) => request.post('/api/catalog/' + OWN_SLUG + '/saved-address', { data: { customer_cedula: cedula, customer_phone: phone } })
  const res = await consulta('21222819', '04241795757')
  const raw = await res.text()
  expect(res.status()).toBe(200)
  // El cliente sembrado por la API puede o no tener dirección válida (eso lo cubre el test de UI de "misma dirección"); aquí importa la FORMA.
  expect(Object.keys(JSON.parse(raw) as Record<string, unknown>)).toEqual(['has_saved_address'])
  expect(raw.replace('has_saved_address', '')).not.toMatch(/ZZB Daniela|name|address|prefill|Oficina/i)
  const otroTel = await (await consulta('21222819', '04149998877')).json() as { has_saved_address: boolean; prefill?: unknown }
  expect(otroTel).toEqual({ has_saved_address: false })
  const sinTel = await (await consulta('21222819', '')).json() as Record<string, unknown>
  expect(sinTel).toEqual({ has_saved_address: false })
})

const sembrarCarrito = async (page: Page): Promise<void> => {
  const cart = [{ product_id: productId, name: 'Smash Burger', qty: 1, price_usd: 11, image_url: null }]
  await page.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value) }, ['activopos_cart_' + OWN_SLUG, JSON.stringify(cart)])
}
const abrirCheckout = async (page: Page): Promise<void> => {
  await page.goto('/catalogo/' + OWN_SLUG)
  await page.getByRole('button', { name: /^Carrito/ }).first().click()
  await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click()
}

test('UI: Daniela Silva · 21.222.819 · 04241795757 · MRW oficina Sebucan (sin ciudad) → pedido enviado; segundo pedido precargado', async ({ page, context }) => {
  await context.route(/wa\.me|api\.whatsapp\.com/, route => route.fulfill({ status: 200, body: 'ok' }))
  await sembrarCarrito(page)
  await abrirCheckout(page)
  await page.getByTestId('checkout-name').fill('ZZB Daniela Silva')
  await page.getByTestId('checkout-phone').fill('04241795757')
  await page.getByTestId('checkout-cedula').fill('21.222.819')
  await page.getByTestId('checkout-next-1').click()
  await page.getByTestId('checkout-delivery-delivery').click()
  await page.getByTestId('checkout-methods').getByText('MRW').click()
  await page.getByTestId('checkout-branch').fill('MRW oficina Sebucan')
  await page.getByTestId('checkout-next-2').click()
  await page.getByTestId('checkout-submit').click()
  await expect(page.getByText('Tu pedido fue enviado por WhatsApp').first()).toBeVisible({ timeout: 30_000 })
  expect(ultimo('client_cedula', "client_name='ZZB Daniela Silva'")).toBe('V-21222819')

  // Mismo navegador: el formulario sale precargado y solo hay que continuar.
  await page.goto('/catalogo/' + OWN_SLUG)
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), ['activopos_cart_' + OWN_SLUG, JSON.stringify([{ product_id: productId, name: 'Smash Burger', qty: 1, price_usd: 11, image_url: null }])])
  await page.reload()
  await page.getByRole('button', { name: /^Carrito/ }).first().click()
  await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click()
  await expect(page.getByTestId('checkout-memory-notice')).toContainText('Usamos tus datos del último pedido')
  await expect(page.getByTestId('checkout-name')).toHaveValue('ZZB Daniela Silva')
  await expect(page.getByTestId('checkout-phone')).toHaveValue('04241795757')
  await expect(page.getByTestId('checkout-next-1')).toBeEnabled()

  // "No soy yo" limpia todo (formulario y memoria).
  await page.getByTestId('checkout-not-me').click()
  await expect(page.getByTestId('checkout-name')).toHaveValue('')
  await expect(page.getByTestId('checkout-phone')).toHaveValue('')
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('activopos:checkout:')))).toBe(false)
})

test('UI: solo nombre y teléfono con MRW (sin cédula ni oficina) pasa; teléfono inválido avisa junto al campo', async ({ page, context }) => {
  await context.route(/wa\.me|api\.whatsapp\.com/, route => route.fulfill({ status: 200, body: 'ok' }))
  await sembrarCarrito(page)
  await abrirCheckout(page)
  await page.getByTestId('checkout-name').fill('ZZB Solo Basico')
  await expect(page.getByTestId('checkout-next-1')).toBeDisabled() // sin teléfono no se puede continuar
  await page.getByTestId('checkout-phone').fill('123')
  await page.getByTestId('checkout-next-1').click()
  await expect(page.getByText('Escribe tu teléfono con 10 u 11 dígitos')).toBeVisible() // aviso junto al campo
  await page.getByTestId('checkout-phone').fill('04141110004')
  await page.getByTestId('checkout-next-1').click()
  await page.getByTestId('checkout-delivery-delivery').click()
  await page.getByTestId('checkout-methods').getByText('MRW').click()
  await page.getByTestId('checkout-next-2').click()
  await page.getByTestId('checkout-submit').click()
  await expect(page.getByText('Tu pedido fue enviado por WhatsApp').first()).toBeVisible({ timeout: 30_000 })
  expect(ultimo('shipping_incomplete', "client_name='ZZB Solo Basico'")).toBe('1')
})

test('Carta: solo nombre y teléfono (delivery sin dirección ni cédula) pasa; el mensaje de WhatsApp sale armado', async ({ page }) => {
  q("UPDATE businesses SET catalog_template='carta' WHERE id=@BID")
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  await page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' }).getByTestId('carta-plato-agregar').click()
  await page.getByTestId('carta-barra-pedido').click()
  await page.getByTestId('carta-modalidad-delivery').click()
  await page.getByTestId('carta-nombre-cliente').fill('ZZB Carta Basico')
  await page.getByTestId('carta-telefono').fill('123')
  await page.getByTestId('carta-enviar').click()
  await expect(page.getByText('Escribe tu teléfono con 10 u 11 dígitos')).toBeVisible() // aviso junto al campo
  await page.getByTestId('carta-telefono').fill('04141110005')
  await page.getByTestId('carta-enviar').click()
  await expect(page.getByTestId('carta-confirmacion')).toBeVisible({ timeout: 30_000 })
  expect(ultimo("IFNULL(client_cedula,'none')", "client_name='ZZB Carta Basico'")).toBe('none')
  await page.evaluate(() => window.localStorage.clear())
})
