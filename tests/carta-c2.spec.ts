import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business'

/**
 * Carta C2: opciones por producto (obligatorias/opcionales, precio extra), nota por línea, agotado del día, etiquetas, alérgenos,
 * relacionados y carrito editable. Negocio propio "ZZ B Pruebas" (prefijo ZZB); el seed deja a Carbonara con tres grupos.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const smashId = (): number => Number(q("SELECT id FROM products WHERE business_id=@BID AND name='Carbonara'"))
const optId = (group: string, name: string): number =>
  Number(q("SELECT o.id FROM product_options o JOIN product_option_groups g ON g.id=o.group_id WHERE g.product_id=" + smashId() + " AND g.name='" + group + "' AND o.name='" + name + "'"))

function limpiar(): void {
  const orders = q("SELECT id FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %'").split('\n').filter(Boolean).join(',')
  if (orders) {
    q('DELETE FROM order_items WHERE order_id IN (' + orders + ')')
    q('DELETE FROM orders WHERE id IN (' + orders + ')')
  }
  q("DELETE FROM inventory_entries WHERE business_id=@BID AND notes LIKE 'Reserva pedido catálogo%'")
  q("DELETE FROM clients WHERE business_id=@BID AND name LIKE 'ZZB %'")
  q('UPDATE products SET sold_out_date=NULL WHERE business_id=@BID')
}

test.beforeAll(() => { bid = ensureOwnBusiness(); limpiar() })
test.afterAll(() => { limpiar() })

let seq = 0
const cliente = (): Record<string, string> => { seq += 1; return { customer_phone: '0414555' + String(1000 + seq), customer_cedula: 'V9' + String(100000 + seq), customer_name: 'ZZB Prueba C2', customer_reference: 'Para llevar', payment_method: 'Bs', payment_kind: 'bs', delivery_type: 'pickup' } }
const pedir = (request: APIRequestContext, items: Record<string, unknown>[]) =>
  request.post('/api/catalog/' + OWN_SLUG + '/order', { data: { ...cliente(), items } })
const ultimaLinea = (cols: string): string => q('SELECT ' + cols + ' FROM order_items WHERE order_id=(SELECT id FROM orders WHERE business_id=@BID ORDER BY id DESC LIMIT 1)')

test('POST /order: el precio extra de las opciones lo pone el servidor y la nota queda en la línea', async ({ request }) => {
  const options = [optId('Proteína', 'Pavo'), optId('Papas', 'Air fryer'), optId('Extras', 'Tocineta')]
  const res = await pedir(request, [{ product_id: smashId(), qty: 2, options, note: 'sin cebolla' }])
  expect(res.status()).toBe(201)
  expect(ultimaLinea("CONCAT(price_per_unit_usd,'|',note,'|',JSON_LENGTH(modifiers))")).toBe('14.5000|sin cebolla|3') // 12 base + 1 air fryer + 1.5 tocineta
})

test('POST /order: ignora precios del cliente y exige los grupos obligatorios', async ({ request }) => {
  const sinObligatorias = await pedir(request, [{ product_id: smashId(), qty: 1, options: [optId('Extras', 'Tocineta')] }])
  expect(sinObligatorias.status()).toBe(422)
  const trampa = await pedir(request, [{ product_id: smashId(), qty: 1, options: [optId('Proteína', 'Pavo'), optId('Papas', 'Fritas')], price_usd: 0.01 }])
  expect(trampa.status()).toBe(201)
  expect(ultimaLinea('price_per_unit_usd')).toBe('12.0000')
})

test('POST /order: opción inventada, dos en grupo único o sobre el tope responden 422', async ({ request }) => {
  const base = [optId('Proteína', 'Pavo'), optId('Papas', 'Fritas')]
  const casos = [
    [...base, 999999999],
    [...base, optId('Proteína', 'Cochino')],
    [...base, optId('Extras', 'Tocineta'), optId('Extras', 'Queso extra'), 999999998],
  ]
  for (const options of casos) expect((await pedir(request, [{ product_id: smashId(), qty: 1, options }])).status(), JSON.stringify(options)).toBe(422)
})

test('agotado del día: la ficha lo marca, /order responde 409 y el día siguiente se limpia solo', async ({ page, request }) => {
  const opts = [optId('Proteína', 'Pavo'), optId('Papas', 'Fritas')]
  q('UPDATE products SET sold_out_date=CURDATE() WHERE id=' + smashId())
  expect((await pedir(request, [{ product_id: smashId(), qty: 1, options: opts }])).status()).toBe(409)
  await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + smashId())
  await expect(page.getByTestId('carta-agotado-hoy')).toBeVisible()
  await expect(page.getByTestId('carta-ficha-agregar')).toBeDisabled()
  q('UPDATE products SET sold_out_date=DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id=' + smashId())
  await page.reload()
  await expect(page.getByTestId('carta-agotado-hoy')).toHaveCount(0)
  expect((await pedir(request, [{ product_id: smashId(), qty: 1, options: opts }])).status()).toBe(201)
})

const abrirFicha = async (page: Page): Promise<void> => { await page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + smashId()) }
const opcion = (page: Page, grupo: string, nombre: string) => page.locator('[data-testid="carta-opcion"][data-grupo="' + grupo + '"][data-opcion="' + nombre + '"]')

test('ficha: opciones en botones grandes, obligatorias bloquean Agregar, extras suman, etiquetas, alérgenos y relacionados', async ({ page }) => {
  await abrirFicha(page)
  await expect(page.getByTestId('carta-grupo')).toHaveCount(3)
  const agregar = page.getByTestId('carta-ficha-agregar')
  await expect(agregar).toBeDisabled()
  await expect(page.getByTestId('carta-faltan')).toContainText('Proteína')
  const caja = await opcion(page, 'Proteína', 'Pavo').boundingBox()
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44)
  await opcion(page, 'Proteína', 'Pavo').click()
  await expect(agregar).toBeDisabled()
  await opcion(page, 'Papas', 'Air fryer').click()
  await expect(agregar).toBeEnabled()
  await expect(agregar).toContainText('$13.00')
  await opcion(page, 'Extras', 'Tocineta').click()
  await expect(agregar).toContainText('$14.50')
  await expect(page.getByTestId('carta-etiqueta').first()).toBeVisible()
  await expect(page.getByTestId('carta-alergenos')).toContainText(/gluten/i)
  await expect(page.getByTestId('carta-relacionados')).toBeVisible()
  expect(await page.getByTestId('carta-relacionados').getByTestId('carta-plato').count()).toBeGreaterThan(0)
})

test('carrito: opciones y nota visibles y editables, y el mensaje de WhatsApp las lista', async ({ page }) => {
  limpiar() // el tope de pedidos pendientes por teléfono (429) cuenta los de los tests anteriores
  await abrirFicha(page)
  await opcion(page, 'Proteína', 'Pavo').click()
  await opcion(page, 'Papas', 'Fritas').click()
  await page.getByTestId('carta-nota').fill('sin cebolla')
  await page.getByTestId('carta-ficha-agregar').click()
  await page.getByTestId('carta-barra-pedido').click()
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('Pavo')
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('sin cebolla')
  await expect(page.getByTestId('carta-total-usd')).toHaveText('$12.00')

  await page.getByTestId('carta-linea-editar').click()
  const editor = page.getByTestId('carta-linea-editor')
  await editor.locator('[data-opcion="Air fryer"]').click()
  await editor.locator('[data-opcion="Cochino"]').click()
  await page.getByTestId('carta-linea-nota').fill('bien cocido')
  await page.getByTestId('carta-linea-guardar').click()
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('Cochino')
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('bien cocido')
  await expect(page.getByTestId('carta-total-usd')).toHaveText('$13.00')

  await page.getByTestId('carta-modalidad-llevar').click()
  await page.getByTestId('carta-nombre-cliente').fill('ZZB Maria')
  await page.getByTestId('carta-telefono').fill('04145559999')
  await page.getByTestId('carta-cedula').fill('V9999999')
  await page.getByTestId('carta-enviar').click()
  await expect(page.getByTestId('carta-confirmacion')).toBeVisible({ timeout: 30_000 })
  const mensaje = await page.getByTestId('carta-mensaje-wa').innerText()
  expect(mensaje).toContain('Cochino')
  expect(mensaje).toContain('Air fryer')
  expect(mensaje).toContain('bien cocido')
  expect(q("SELECT CONCAT(price_per_unit_usd,'|',note) FROM order_items WHERE order_id=(SELECT id FROM orders WHERE business_id=@BID AND client_name='ZZB Maria' LIMIT 1)")).toBe('13.0000|bien cocido')
})

test('PATCH /api/config/carta es solo para el admin del negocio', async ({ request }) => {
  const res = await request.patch('/api/config/carta', { data: { carta_paused: true }, maxRedirects: 0 })
  expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status())
})
