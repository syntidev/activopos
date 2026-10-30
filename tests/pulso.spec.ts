import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { mkdirSync } from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * Pulso (analítica del catálogo público): ingesta, privacidad, aislamiento entre negocios, rate limit, bots,
 * order_created en el servidor y panel /pulso. Negocio 80 (slug boutique-demo), plantilla premium mientras corre
 * (se restaura). Datos ZZ / sesiones `cccccccc-…`; al final todo se borra y se verifica conteo 0.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const OTHER_BUSINESS_ID = 87
const ADMIN_ID = 79
const SLUG = 'boutique-demo'
const OTHER_SLUG = 'onbike'
const TAG = String(Date.now()).slice(-6)
const CAMP = `zz-pulso-${TAG}`
const SID = (n: number): string => `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`
const UA_PERSONA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const CAPTURAS = path.join(__dirname, '__capturas__', 'pulso')
const HOME = `/catalogo-premium/${SLUG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let originalTemplate = ''
let startedAt = ''
let productId = 0
let brandId = 0

async function token(role: 'admin' | 'cashier'): Promise<string> {
  return new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role, name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

async function login(page: Page, role: 'admin' | 'cashier' = 'admin'): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(role), url: BASE }])
}

function cleanup(): void {
  sql(`DELETE FROM catalog_events WHERE session_id LIKE 'cccccccc-%' OR utm_campaign LIKE 'zz-pulso%' OR (business_id=${BUSINESS_ID} AND created_at >= '${startedAt || '2999-01-01'}')`)
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Pulso%'`).split('\n').filter(Boolean).join(',')
  sql(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Pulso%')`)
  sql(`DELETE FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Pulso%'`)
  sql(`DELETE FROM clients WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Pulso%'`)
  if (ids) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Pulso%'`)
  if (startedAt) sql(`DELETE FROM web_order_locks WHERE business_id=${BUSINESS_ID} AND touched_at >= '${startedAt}'`)
}

const eventos = (where: string): number =>
  Number(sql(`SELECT COUNT(*) FROM catalog_events WHERE ${where}`))

test.beforeAll(async () => {
  startedAt = sql('SELECT DATE_FORMAT(NOW(3), "%Y-%m-%d %H:%i:%s.%f")')
  cleanup()
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token('admin')}` } })
  const b = await api.post('/api/brands', { data: { name: 'ZZ Pulso Marca', search_term: 'zz pulso' } })
  expect(b.status(), await b.text()).toBeLessThan(300)
  brandId = Number(sql(`SELECT id FROM brands WHERE business_id=${BUSINESS_ID} AND name='ZZ Pulso Marca'`))
  const p = await api.post('/api/products', {
    data: { name: 'ZZ Pulso Reloj', cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 20, show_in_catalog: true, catalog_visibility: 'visible', brand_id: brandId },
  })
  expect(p.status(), await p.text()).toBe(201)
  productId = ((await p.json()) as { product: { id: number } }).product.id
})

test.afterAll(async () => {
  cleanup()
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  await api.dispose()
  // Confirmación: cero datos ZZ / eventos de prueba y plantilla original restaurada.
  expect(eventos(`session_id LIKE 'cccccccc-%' OR utm_campaign LIKE 'zz-pulso%' OR (business_id=${BUSINESS_ID} AND created_at >= '${startedAt}')`)).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Pulso%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ Pulso%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM orders WHERE business_id=${BUSINESS_ID} AND client_name LIKE 'ZZ Pulso%'`))).toBe(0)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

/** POST /api/public/events como visitante anónimo (sin sesión de usuario). */
async function enviar(body: object, ua: string = UA_PERSONA, headers: Record<string, string> = {}) {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': ua, ...headers } })
  try { return await ctx.post('/api/public/events', { data: body }) } finally { await ctx.dispose() }
}

const lote = (slug: string, sessionId: number, events: object[], attribution?: object) =>
  ({ slug, session_id: SID(sessionId), ...(attribution ? { attribution } : {}), events })

test('visita con UTM: page_view con el negocio correcto y la atribución', async ({ page }) => {
  await expect(async () => {
    await page.goto(`${HOME}?utm_source=ZZ-IG&utm_medium=social&utm_campaign=${CAMP}`)
    await expect.poll(() => eventos(`business_id=${BUSINESS_ID} AND type='page_view' AND utm_campaign='${CAMP}'`), { timeout: 12_000 }).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 90_000 })
  const fila = sql(`SELECT CONCAT_WS('|', utm_source, utm_medium, device) FROM catalog_events WHERE business_id=${BUSINESS_ID} AND type='page_view' AND utm_campaign='${CAMP}' ORDER BY id LIMIT 1`)
  expect(fila).toBe('zz-ig|social|desktop')
  // Nada de esa visita cae en otro negocio.
  expect(eventos(`business_id <> ${BUSINESS_ID} AND utm_campaign='${CAMP}'`)).toBe(0)
})

test('búsqueda sin resultados registrada con results_count 0', async ({ page }) => {
  await expect(async () => {
    await page.goto(`${HOME}/productos?utm_campaign=${CAMP}`)
    await page.locator('input[type="search"]:visible').first().fill('zzzzqxk')
    await expect.poll(
      () => eventos(`business_id=${BUSINESS_ID} AND type='search' AND query='zzzzqxk' AND results_count=0 AND utm_campaign='${CAMP}'`),
      { timeout: 12_000 },
    ).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 90_000 })
})

test('ficha, carrito y checkout: product_view (con marca), add_to_cart y checkout_start', async ({ page }) => {
  await expect(async () => {
    await page.goto(`${HOME}/p/${productId}?utm_campaign=${CAMP}`)
    await expect.poll(() => eventos(`business_id=${BUSINESS_ID} AND type='product_view' AND product_id=${productId} AND brand_id=${brandId}`), { timeout: 12_000 }).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 90_000 })

  await page.goto(`${HOME}/productos`)
  await page.getByRole('button', { name: 'Agregar ZZ Pulso Reloj al carrito' }).first().click()
  await expect(async () => {
    await page.getByRole('button', { name: /^Carrito/ }).first().click({ timeout: 4000 })
    await page.getByRole('button', { name: 'Finalizar por WhatsApp' }).click({ timeout: 4000 })
  }).toPass({ timeout: 30_000 })
  await expect.poll(() => eventos(`business_id=${BUSINESS_ID} AND type='add_to_cart' AND product_id=${productId}`), { timeout: 20_000 }).toBeGreaterThanOrEqual(1)
  await expect.poll(() => eventos(`business_id=${BUSINESS_ID} AND type='checkout_start'`), { timeout: 20_000 }).toBeGreaterThanOrEqual(1)
})

const PEDIDO = {
  items: [{ product_id: 0, qty: 2 }],
  customer_name: 'ZZ Pulso Cliente', customer_phone: '04141230000', customer_reference: 'ZZ Pulso referencia',
  customer_cedula: 'V-12345678', payment_method: 'ZZ Pulso Efectivo', payment_kind: 'divisa',
}

test('pedido: order_created lo escribe el servidor con order_id, valor y la sesión/UTM del cliente', async () => {
  const pub = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': UA_PERSONA } })
  const r = await pub.post(`/api/catalog/${SLUG}/order`, {
    data: { ...PEDIDO, items: [{ product_id: productId, qty: 2 }], pulso: { session_id: SID(1), utm_source: 'zz-ig', utm_campaign: CAMP } },
  })
  const cuerpo = await r.text()
  await pub.dispose()
  expect(r.status(), cuerpo).toBeLessThan(300)
  const orderId = Number(sql(`SELECT id FROM orders WHERE business_id=${BUSINESS_ID} AND client_name='ZZ Pulso Cliente' ORDER BY id DESC LIMIT 1`))
  expect(orderId).toBeGreaterThan(0)
  const ev = sql(`SELECT CONCAT_WS('|', business_id, order_id, value_usd, utm_source, utm_campaign) FROM catalog_events WHERE type='order_created' AND session_id='${SID(1)}'`)
  expect(ev).toBe(`${BUSINESS_ID}|${orderId}|20.00|zz-ig|${CAMP}`)
  // El valor sale del servidor: coincide con el total del pedido.
  expect(sql(`SELECT total_usd FROM orders WHERE id=${orderId}`)).toBe('20.00')
})

test('un bloque pulso malformado NO tumba el pedido (la analítica nunca bloquea una venta)', async () => {
  const pub = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': UA_PERSONA } })
  const r = await pub.post(`/api/catalog/${SLUG}/order`, {
    data: {
      ...PEDIDO, items: [{ product_id: productId, qty: 1 }], customer_name: 'ZZ Pulso Cliente Malo',
      customer_phone: '04141230001', customer_cedula: 'V-12345679',
      pulso: { session_id: 'no-es-uuid', campo_inventado: true },
    },
  })
  const cuerpo = await r.text()
  await pub.dispose()
  expect(r.status(), cuerpo).toBeLessThan(300)
  const orderId = Number(sql(`SELECT id FROM orders WHERE business_id=${BUSINESS_ID} AND client_name='ZZ Pulso Cliente Malo' ORDER BY id DESC LIMIT 1`))
  expect(orderId).toBeGreaterThan(0)
  // Con analítica inválida el evento igual queda, con una sesión generada por el servidor.
  expect(eventos(`type='order_created' AND order_id=${orderId} AND value_usd=10.00`)).toBe(1)
})

test('aislamiento entre negocios: business_id del body se rechaza, el slug manda y los ids ajenos se descartan', async () => {
  // business_id en el body: zod estricto → 400.
  const espia = await enviar({ ...lote(SLUG, 2, [{ type: 'page_view', path: HOME }]), business_id: OTHER_BUSINESS_ID })
  expect(espia.status()).toBe(400)
  expect(eventos(`session_id='${SID(2)}'`)).toBe(0)

  // Mismo lote válido a cada slug: cada fila cae SOLO en el negocio de su slug.
  expect((await enviar(lote(SLUG, 3, [{ type: 'page_view', path: HOME }]))).status()).toBe(204)
  expect((await enviar(lote(OTHER_SLUG, 4, [{ type: 'page_view', path: `/catalogo-premium/${OTHER_SLUG}` }]))).status()).toBe(204)
  expect(eventos(`session_id='${SID(3)}' AND business_id=${BUSINESS_ID}`)).toBe(1)
  expect(eventos(`session_id='${SID(3)}' AND business_id<>${BUSINESS_ID}`)).toBe(0)
  expect(eventos(`session_id='${SID(4)}' AND business_id=${OTHER_BUSINESS_ID}`)).toBe(1)

  // product_id de OTRO negocio con el slug de este: ese evento se descarta (el page_view del lote sí pasa).
  const ajeno = Number(sql(`SELECT id FROM products WHERE business_id=${OTHER_BUSINESS_ID} ORDER BY id LIMIT 1`))
  const r = await enviar(lote(SLUG, 5, [
    { type: 'page_view', path: HOME },
    { type: 'product_view', path: `${HOME}/p/${ajeno}`, product_id: ajeno },
  ]))
  expect(r.status()).toBe(204)
  expect(eventos(`session_id='${SID(5)}' AND type='page_view'`)).toBe(1)
  expect(eventos(`session_id='${SID(5)}' AND type='product_view'`)).toBe(0)

  // Slug inexistente → 404; order_created no se acepta desde el cliente.
  expect((await enviar(lote('zz-no-existe', 6, [{ type: 'page_view', path: '/catalogo-premium/zz-no-existe' }]))).status()).toBe(404)
  expect((await enviar(lote(SLUG, 6, [{ type: 'order_created', path: HOME }]))).status()).toBe(400)
})

test('privacidad: ni IP ni user-agent crudo en la tabla; país/ciudad solo de Cloudflare; búsquedas con teléfono/cédula/email se descartan', async () => {
  const r = await enviar(lote(SLUG, 7, [
    { type: 'page_view', path: HOME },
    { type: 'search', path: `${HOME}/productos`, query: '04141234567', results_count: 0 },
    { type: 'search', path: `${HOME}/productos`, query: 'juan@correo.com', results_count: 0 },
    { type: 'search', path: `${HOME}/productos`, query: 'casco', results_count: 3 },
  ]), UA_PERSONA, { 'cf-ipcountry': 'VE', 'cf-ipcity': 'Porlamar', 'x-forwarded-for': '203.0.113.77' })
  expect(r.status()).toBe(204)
  const columnas = sql(`SELECT GROUP_CONCAT(column_name) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='catalog_events'`)
  expect(columnas).not.toMatch(/(^|,)(ip|user_agent|ua)(,|$)/)
  expect(sql(`SELECT CONCAT_WS('|', country, city, device, os, browser) FROM catalog_events WHERE session_id='${SID(7)}' AND type='page_view'`)).toBe('VE|Porlamar|desktop|Windows|Chrome')
  expect(eventos(`session_id='${SID(7)}' AND CONCAT_WS(' ', path, IFNULL(query,''), IFNULL(referrer_host,''), IFNULL(city,'')) LIKE '%203.0.113.77%'`)).toBe(0)
  // Datos personales tecleados en el buscador: no quedan guardados; la búsqueda normal sí.
  expect(eventos(`session_id='${SID(7)}' AND type='search' AND query IN ('04141234567','juan@correo.com')`)).toBe(0)
  expect(eventos(`session_id='${SID(7)}' AND type='search' AND query='casco'`)).toBe(1)
})

test('límites del endpoint: Do-Not-Track del navegador, cuerpo enorme y path de otro catálogo', async () => {
  // DNT del servidor (cabecera DNT/Sec-GPC): 204 y no se guarda.
  expect((await enviar(lote(SLUG, 13, [{ type: 'page_view', path: HOME }]), UA_PERSONA, { dnt: '1' })).status()).toBe(204)
  expect((await enviar(lote(SLUG, 13, [{ type: 'page_view', path: HOME }]), UA_PERSONA, { 'sec-gpc': '1' })).status()).toBe(204)
  expect(eventos(`session_id='${SID(13)}'`)).toBe(0)
  // Cuerpo > 16 KB → 413 (no se parsea).
  const grande = await enviar({ ...lote(SLUG, 14, [{ type: 'page_view', path: HOME }]), relleno: 'x'.repeat(40_000) })
  expect(grande.status()).toBe(413)
  // path que no pertenece a este slug o trae query string → 400.
  expect((await enviar(lote(SLUG, 15, [{ type: 'page_view', path: `/catalogo-premium/${OTHER_SLUG}` }]))).status()).toBe(400)
  expect((await enviar(lote(SLUG, 15, [{ type: 'page_view', path: `${HOME}?telefono=04141234567` }]))).status()).toBe(400)
  expect(eventos(`session_id IN ('${SID(14)}','${SID(15)}')`)).toBe(0)
})

test('bot ignorado: 204 y nada se guarda', async () => {
  for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', 'Mozilla/5.0 (compatible; bingbot/2.0)']) {
    const r = await enviar(lote(SLUG, 8, [{ type: 'page_view', path: HOME }]), ua)
    expect(r.status(), ua).toBe(204)
  }
  expect(eventos(`session_id='${SID(8)}'`)).toBe(0)
})

const TIPS: [string, string][] = [
  ['Llamadas', 'Toques en los botones de llamar del catálogo. Mide intención de llamar; la llamada ocurre en el teléfono y no se puede confirmar.'],
  ['Clics a WhatsApp', 'Toques en los botones de WhatsApp. Mide intención de escribir, no mensajes enviados.'],
  ['Visitantes · 7 días', 'Navegadores distintos en el periodo. No cuenta al personal con sesión ni a los equipos marcados con ?pulso=off.'],
  ['Embudo', 'Pedido pagado: Pedidos del catálogo que el equipo marcó como pagados en ActivoPOS.'],
  ['Origen de las visitas', 'Visitas sin etiqueta UTM. Agrega utm_source y utm_campaign a tus enlaces para ver el canal.'],
  ['Búsquedas sin resultados', 'Lo que buscaron y no encontraron: candidatos para traer o para sinónimos.'],
  ['Ciudades', 'Requiere el ajuste de ubicación de visitantes en Cloudflare.'],
]

test('tráfico interno: con sesión de ActivoPOS el tracker no envía y el servidor descarta el lote', async ({ page }) => {
  const camp = `${CAMP}-int`
  await login(page)
  await page.goto(`${HOME}?utm_campaign=${camp}`)
  await page.goto(`${HOME}/productos?utm_campaign=${camp}`)
  await page.waitForTimeout(6000) // más que el retardo de envío del tracker (3 s)
  expect(eventos(`utm_campaign='${camp}'`)).toBe(0)

  // Barrera del servidor: un lote válido con la cookie de sesión se responde 204 y no guarda nada.
  const staff = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': UA_PERSONA, cookie: `activopos_session=${await token('cashier')}` } })
  const r = await staff.post('/api/public/events', { data: lote(SLUG, 20, [{ type: 'page_view', path: HOME }]) })
  const quien = await staff.get('/api/public/events')
  const quienJson = (await quien.json()) as { internal: boolean }
  await staff.dispose()
  expect(r.status()).toBe(204)
  expect(quienJson.internal).toBe(true)
  expect(eventos(`session_id='${SID(20)}'`)).toBe(0)
  // Sin sesión, el mismo lote sí cuenta y GET responde internal:false.
  expect((await enviar(lote(SLUG, 20, [{ type: 'page_view', path: HOME }]))).status()).toBe(204)
  expect(eventos(`session_id='${SID(20)}'`)).toBe(1)
  const anon = await pwRequest.newContext({ baseURL: BASE })
  expect(((await (await anon.get('/api/public/events')).json()) as { internal: boolean }).internal).toBe(false)
  await anon.dispose()
})

test('?pulso=off deja de registrar en ese navegador y ?pulso=on lo devuelve', async ({ page }) => {
  const off = `${CAMP}-off`
  const on = `${CAMP}-on`
  await page.goto(`${HOME}?pulso=off&utm_campaign=${off}`)
  await page.goto(`${HOME}/productos?utm_campaign=${off}`)
  await page.waitForTimeout(6000)
  expect(eventos(`utm_campaign='${off}'`)).toBe(0)
  await expect(page.getByText(/pulso/i).filter({ hasText: /off|desactiv/i })).toHaveCount(0) // nada visible para el cliente
  expect(await page.evaluate(() => localStorage.getItem('activopos_pulso_off'))).toBe('1')

  await expect(async () => {
    await page.goto(`${HOME}?pulso=on&utm_campaign=${on}`)
    await expect.poll(() => eventos(`business_id=${BUSINESS_ID} AND type='page_view' AND utm_campaign='${on}'`), { timeout: 12_000 }).toBeGreaterThanOrEqual(1)
  }).toPass({ timeout: 90_000 })
  expect(await page.evaluate(() => localStorage.getItem('activopos_pulso_off'))).toBeNull()
})

test('el pedido del personal sigue registrando order_created (es venta real)', async () => {
  const staff = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': UA_PERSONA, cookie: `activopos_session=${await token('admin')}` } })
  const r = await staff.post(`/api/catalog/${SLUG}/order`, {
    data: { ...PEDIDO, customer_phone: '04141230001', items: [{ product_id: productId, qty: 1 }], pulso: { session_id: SID(21), utm_campaign: `${CAMP}-int` } },
  })
  const cuerpo = await r.text()
  await staff.dispose()
  expect(r.status(), cuerpo).toBeLessThan(300)
  expect(eventos(`type='order_created' AND session_id='${SID(21)}' AND business_id=${BUSINESS_ID} AND value_usd=10.00`)).toBe(1)
})

test('panel /pulso: cada indicador explica qué mide (teclado, táctil ≥44px, 375px sin desborde)', async ({ page }) => {
  await login(page)
  await page.goto('/pulso?dias=7')
  await expect(page.getByRole('heading', { name: 'Pulso', exact: true })).toBeVisible()

  for (const [nombre, texto] of TIPS) {
    const btn = page.getByRole('button', { name: `Qué mide: ${nombre}` })
    await expect(btn, nombre).toBeVisible()
    const box = await btn.boundingBox()
    expect(box!.width, `${nombre} ancho`).toBeGreaterThanOrEqual(44)
    expect(box!.height, `${nombre} alto`).toBeGreaterThanOrEqual(44)
    await btn.focus()
    await page.keyboard.press('Enter')
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('tooltip').filter({ hasText: texto }), nombre).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('tooltip').filter({ hasText: texto })).toBeHidden()
  }

  // Tocar fuera cierra.
  const v = page.getByRole('button', { name: 'Qué mide: Visitantes · 7 días' })
  await v.click()
  await page.getByRole('heading', { name: 'Pulso', exact: true }).click()
  await expect(v).toHaveAttribute('aria-expanded', 'false')

  // Capturas con un tooltip abierto (sin versionar).
  mkdirSync(CAPTURAS, { recursive: true })
  for (const [ancho, alto] of [[1280, 2200], [375, 3600]] as const) {
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto('/pulso?dias=7')
    await expect(page.getByRole('heading', { name: 'Pulso', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Qué mide: Visitantes · 7 días' }).click()
    await expect(page.getByRole('tooltip').filter({ hasText: 'Navegadores distintos' })).toBeVisible()
    await page.screenshot({ path: path.join(CAPTURAS, `pulso-tooltip-${ancho}.png`) })
    // El popover no se sale de la pantalla.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `sin desborde ${ancho}px`).toBeLessThanOrEqual(0)
    const tb = await page.getByRole('tooltip').filter({ hasText: 'Navegadores distintos' }).boundingBox()
    expect(tb!.x).toBeGreaterThanOrEqual(0)
    // Y queda por encima de los bloques vecinos (no tapado).
    const tapado = await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('[role="tooltip"]'), { x: tb!.x + 20, y: tb!.y + 10 })
    expect(tapado, `tooltip tapado a ${ancho}px`).toBe(false)
    expect(tb!.x + tb!.width).toBeLessThanOrEqual(ancho)
  }
})

const busquedas = (camp: string, like: string): number =>
  eventos(`business_id=${BUSINESS_ID} AND type='search' AND utm_campaign='${camp}' AND query LIKE '${like}'`)

test('búsqueda: teclear "garmin" letra por letra deja UN solo evento (y reemplaza la consulta anterior)', async ({ page }) => {
  const camp = `${CAMP}-tec`
  await page.goto(`${HOME}/productos?utm_campaign=${camp}`)
  const input = page.locator('input[type="search"]:visible').first()
  await input.pressSequentially('gar', { delay: 80 })
  await page.waitForTimeout(2200) // se asienta "gar" (1500 ms)
  await input.pressSequentially('min', { delay: 80 }) // sigue la misma consulta dentro de 10 s: reemplaza
  await expect.poll(() => busquedas(camp, 'garmin'), { timeout: 30_000 }).toBe(1)
  await page.waitForTimeout(2000)
  expect(busquedas(camp, '%'), 'un solo evento de búsqueda, sin prefijos: ' + sql(`SELECT GROUP_CONCAT(query) FROM catalog_events WHERE type='search' AND utm_campaign='${camp}'`)).toBe(1)
})

test('búsqueda: Enter la registra sin esperar y el prefijo intermedio no se guarda', async ({ page }) => {
  const camp = `${CAMP}-ent`
  await page.goto(`${HOME}/productos?utm_campaign=${camp}`)
  const input = page.locator('input[type="search"]:visible').first()
  await input.pressSequentially('zzenter', { delay: 60 })
  await input.press('Enter')
  await expect.poll(() => busquedas(camp, 'zzenter'), { timeout: 30_000 }).toBe(1)
  expect(busquedas(camp, '%')).toBe(1)
})

test('servidor: basura y búsquedas de 1 carácter no se guardan, con respuesta normal', async () => {
  const camp = `${CAMP}-bad`
  const basura = ['<script>alert(1)</script>', '<s', 'a', ' ', '!!', 'x'.repeat(61), 'hola\u0007']
  for (const [i, q] of basura.entries()) {
    const r = await enviar(lote(SLUG, 40 + i, [{ type: 'search', path: `${HOME}/productos`, query: q, results_count: 0 }], { utm_campaign: camp }))
    expect(r.status(), q).toBe(204)
  }
  const ok = await enviar(lote(SLUG, 50, [{ type: 'search', path: `${HOME}/productos`, query: 'zzvalida', results_count: 0 }], { utm_campaign: camp }))
  expect(ok.status()).toBe(204)
  expect(busquedas(camp, '%')).toBe(1)
  expect(busquedas(camp, 'zzvalida')).toBe(1)
})

test('panel: las búsquedas se agrupan sin tildes y en minúsculas', async ({ page }) => {
  const camp = `${CAMP}-agr`
  for (const [i, q] of ['ZZCamión', 'zzcamion', 'ZZCAMIÓN'].entries()) {
    expect((await enviar(lote(SLUG, 60 + i, [{ type: 'search', path: `${HOME}/productos`, query: q, results_count: 0 }], { utm_campaign: camp }))).status()).toBe(204)
  }
  await login(page)
  await page.goto('/pulso?dias=7')
  const fila = page.locator('li', { hasText: 'zzcamion' }).first()
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('3')
  await expect(page.getByText(/ZZCami|zzcamió/)).toHaveCount(0)
})

test('panel /pulso: muestra los conteos reales y exige ser admin', async ({ page }) => {
  // Datos deterministas del panel (sesiones cccccccc-…-0010..12), además de lo que dejaron los tests anteriores.
  const attr = { utm_source: 'zz-wa', utm_campaign: CAMP }
  for (const n of [10, 11, 12]) {
    expect((await enviar(lote(SLUG, n, [{ type: 'page_view', path: HOME }, { type: 'whatsapp_click', path: HOME }], attr))).status()).toBe(204)
  }
  expect((await enviar(lote(SLUG, 12, [{ type: 'search', path: `${HOME}/productos`, query: 'zzzzqxk', results_count: 0 }], attr))).status()).toBe(204)

  const visitantes = Number(sql(`SELECT COUNT(DISTINCT session_id) FROM catalog_events WHERE business_id=${BUSINESS_ID} AND type='page_view' AND created_at >= NOW() - INTERVAL 5 DAY`))
  const clicsWa = Number(sql(`SELECT COUNT(*) FROM catalog_events WHERE business_id=${BUSINESS_ID} AND type='whatsapp_click' AND created_at >= NOW() - INTERVAL 5 DAY`))
  expect(visitantes).toBeGreaterThanOrEqual(5)
  expect(clicsWa).toBeGreaterThanOrEqual(3)

  await login(page)
  await page.goto('/pulso?dias=7')
  await expect(page.getByRole('heading', { name: 'Pulso', exact: true })).toBeVisible()
  await expect(page.getByText('Visitantes en 7 días', { exact: true }).locator('xpath=following-sibling::dd')).toHaveText(visitantes.toLocaleString('es-VE'))
  await expect(page.getByText('Búsquedas sin resultados').first()).toBeVisible()
  await expect(page.getByText('zzzzqxk').first()).toBeVisible()
  await expect(page.getByText('zz-wa').first()).toBeVisible()
  // Pedidos de prueba ($20.00 + $10.00 + $10.00 del personal = $40.00): USD y su equivalente en Bs, siempre juntos.
  await expect(page.getByText('$40.00').first()).toBeVisible()
  await expect(page.getByText(/Bs\./).first()).toBeVisible()
  await expect(page.getByText(String(clicsWa), { exact: true }).first()).toBeVisible()

  // Capturas (sin versionar).
  mkdirSync(CAPTURAS, { recursive: true })
  // El dashboard scrollea dentro de un contenedor (no del documento): un viewport alto captura el panel completo.
  await page.setViewportSize({ width: 1280, height: 2200 })
  await page.goto('/pulso?dias=7')
  await expect(page.getByRole('heading', { name: 'Pulso', exact: true })).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURAS, 'pulso-1280.png') })
  await page.setViewportSize({ width: 375, height: 3600 })
  await page.goto('/pulso?dias=7')
  await expect(page.getByRole('heading', { name: 'Pulso', exact: true })).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURAS, 'pulso-375.png') })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'sin scroll horizontal a 375px').toBeLessThanOrEqual(0)
})

test('panel /pulso: el cajero y el visitante sin sesión no entran', async ({ page }) => {
  await login(page, 'cashier')
  await page.goto('/pulso')
  await expect(page).not.toHaveURL(/\/pulso/)
  await page.context().clearCookies()
  await page.goto('/pulso')
  await expect(page).toHaveURL(/\/login/)
})

test('rate limit: pasado el tope por IP+slug responde 429', async () => {
  // Con UA de bot el servidor corta después del limitador y sin tocar la base: no deja filas.
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'user-agent': 'curl/8.4.0' } })
  const estados: number[] = []
  for (let i = 0; i < 130; i++) {
    const r = await ctx.post('/api/public/events', { data: lote(OTHER_SLUG, 9, [{ type: 'page_view', path: `/catalogo-premium/${OTHER_SLUG}` }]) })
    estados.push(r.status())
  }
  await ctx.dispose()
  expect(estados.filter(s => s === 429).length).toBeGreaterThanOrEqual(1)
  expect(estados.slice(0, 30).every(s => s === 204)).toBe(true)
  expect(eventos(`session_id='${SID(9)}'`)).toBe(0)
})
