import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * Certificación POS 2026-11-02. Negocio 80, servidor local, datos ZZ Cert creados aquí y borrados al final.
 * Compara lo que muestra la pantalla contra lo que queda en DB (sales, sale_items, sale_payments, stock).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-6)
const N = (s: string) => `ZZ Cert ${s} ${TAG}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let admin: APIRequestContext
let cashier: APIRequestContext
let abriCaja = false
const id: Record<string, number> = {}
const vid: Record<string, number> = {}
const sales: number[] = []

const token = (role: 'admin' | 'cashier') =>
  new SignJWT({ userId: ADMIN_ID, businessId: BID, role, name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

const stockProducto = (pid: number): number => Number(sql(`SELECT COALESCE(SUM(quantity)-SUM(waste),0) FROM inventory_entries WHERE product_id=${pid}`))
const stockTalla = (v: number): number => Number(sql(`SELECT stock FROM product_variants WHERE id=${v}`))
const ultimaVenta = (): number => Number(sql(`SELECT MAX(id) FROM sales WHERE business_id=${BID} AND status='paid'`))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ Cert%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  const s = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (s) {
    sql(`DELETE ri FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE r.sale_id IN (${s})`)
    sql(`DELETE FROM returns WHERE sale_id IN (${s})`)
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${s})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${s})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${s})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

async function crear(data: Record<string, unknown>): Promise<{ id: number; variants: Array<{ id: number; valor: string }> }> {
  const r = await admin.post('/api/products', { data })
  expect(r.status(), await r.text()).toBe(201)
  return ((await r.json()) as { product: { id: number; variants: Array<{ id: number; valor: string }> } }).product
}

test.beforeAll(async () => {
  cleanup()
  admin = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token('admin')}` } })
  cashier = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token('cashier')}` } })
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
    const open = await admin.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0, close_notes: 'ZZ cert-pos' } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  // PIN de autorización = contraseña de un usuario del negocio (verifyPin): usuario ZZ con PIN 1234, borrado en afterAll.
  sql(`INSERT INTO users (business_id,name,email,password,role,is_active,created_at,updated_at) VALUES (${BID},'ZZ Cert PIN','zz-cert-pin@example.invalid','$2b$10$MX6AL3RSSGCxUKo4vBp.JeBCXr5bLGb0AzDpw1sbeAMPkuIYmDl2W','admin',1,NOW(3),NOW(3))`)
  const base = { is_fixed_price: true, cost_per_unit_usd: 2 }
  id.simple = (await crear({ ...base, name: N('Simple'), price_per_unit_usd: 10, wholesale_price_usd: 8, stock_quantity: 50, barcode: `ZZC${TAG}1`, sku: `ZZCS${TAG}` })).id
  id.sinDivisa = (await crear({ ...base, name: N('SinDivisa'), price_per_unit_usd: 6, stock_quantity: 50 })).id
  id.peso = (await crear({ ...base, name: N('Peso'), sale_mode: 'weight', price_per_kg_usd: 8, price_per_unit_usd: null, stock_quantity: 50 })).id
  const t = await crear({
    ...base, name: N('Talla'), price_per_unit_usd: 40, stock_quantity: 0, has_variants: true,
    variants: ['S', 'M', 'L'].map(valor => ({ tipo: 'talla', valor, stock: 5, sku: `ZZCT${TAG}${valor}`, barcode: `ZZCB${TAG}${valor}` })),
  })
  id.talla = t.id
  for (const v of t.variants) vid[v.valor] = v.id
  const p = await admin.patch(`/api/products/${id.talla}/variants/${vid.M}`, { data: { divisa_price_usd: 30 } })
  expect(p.status(), await p.text()).toBe(200)
})

test.afterAll(async () => {
  cleanup()
  sql(`DELETE FROM users WHERE business_id=${BID} AND name='ZZ Cert PIN'`)
  if (abriCaja && admin) await admin.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ cert-pos' } })
  await admin?.dispose()
  await cashier?.dispose()
})

async function abrirPos(page: Page, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height })
  await page.context().addCookies([{ name: 'activopos_session', value: await token('admin'), url: BASE }])
  await page.goto('/pos')
  await expect(page.getByPlaceholder('Buscar producto o código...')).toBeVisible({ timeout: 20_000 })
}

async function buscar(page: Page, q: string): Promise<void> {
  const box = page.getByPlaceholder('Buscar producto o código...')
  await box.fill('')
  await box.fill(q)
}

async function cobrarUnMetodo(page: Page, metodo: string): Promise<{ uiTotalUsd: string }> {
  await page.getByRole('button', { name: 'Procesar Pago' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg).toBeVisible()
  const uiTotalUsd = (await dlg.locator('[class*="totalUsd"]').first().textContent()) ?? ''
  await dlg.getByRole('button', { name: new RegExp(`^${metodo}$`) }).click()
  await dlg.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByRole('dialog', { name: 'Venta registrada' })).toBeVisible({ timeout: 20_000 })
  sales.push(ultimaVenta())
  return { uiTotalUsd }
}

test('a) búsqueda por nombre, código de barras, SKU y código/SKU de talla', async ({ page }) => {
  await abrirPos(page)
  const cards = page.getByTestId('product-card')
  await buscar(page, N('Simple'))
  await expect(cards.filter({ hasText: N('Simple') }).first()).toBeVisible()
  await buscar(page, `ZZC${TAG}1`)
  await expect(cards.filter({ hasText: N('Simple') }).first()).toBeVisible()
  await buscar(page, `ZZCS${TAG}`)
  await expect(cards.filter({ hasText: N('Simple') }).first()).toBeVisible()
  await buscar(page, `ZZCB${TAG}M`)
  await expect(cards.filter({ hasText: N('Talla') }).first()).toBeVisible()
  await buscar(page, `ZZCT${TAG}L`)
  await expect(cards.filter({ hasText: N('Talla') }).first()).toBeVisible()
  await page.screenshot({ path: 'tests/__capturas__/cert-a-busqueda-1280.png' })
})

test('c-d) venta simple x2 en USD cuadra pantalla vs DB y descuenta stock', async ({ page }) => {
  const antes = stockProducto(id.simple)
  await abrirPos(page)
  await buscar(page, N('Simple'))
  const card = page.getByTestId('product-card').filter({ hasText: N('Simple') }).first()
  await card.click(); await card.click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)
  await expect(page.locator('[class*="totalUsdValue"]')).toContainText('20.00')
  const r = await cobrarUnMetodo(page, 'Efectivo USD')
  const v = ultimaVenta()
  expect(r.uiTotalUsd).toContain('20.00')
  expect(Number(sql(`SELECT total_usd FROM sales WHERE id=${v}`))).toBe(20)
  expect(sql(`SELECT status FROM sales WHERE id=${v}`)).toBe('paid')
  expect(Number(sql(`SELECT price_per_unit_usd FROM sale_items WHERE sale_id=${v}`))).toBe(10)
  expect(Number(sql(`SELECT SUM(amount_usd) FROM sale_payments WHERE sale_id=${v}`))).toBeGreaterThanOrEqual(20)
  expect(stockProducto(id.simple)).toBe(antes - 2)
})

test('d) CARGO global 10%: lo que muestra la pantalla vs lo que queda en DB', async ({ page }) => {
  await abrirPos(page)
  await buscar(page, N('SinDivisa'))
  await page.getByTestId('product-card').filter({ hasText: N('SinDivisa') }).first().click()
  await page.getByRole('button', { name: 'Cargo', exact: true }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Porcentaje de cargo').fill('10')
  await dlg.getByRole('button', { name: /Aplicar/ }).click()
  await expect(page.locator('[class*="totalUsdValue"]')).toContainText('6.60')
  const r = await cobrarUnMetodo(page, 'Efectivo USD')
  const v = ultimaVenta()
  const dbTotal = Number(sql(`SELECT total_usd FROM sales WHERE id=${v}`))
  const dbPaid = Number(sql(`SELECT SUM(amount_usd) FROM sale_payments WHERE sale_id=${v}`))
  console.log(`CARGO ui=${r.uiTotalUsd.trim()} db.total_usd=${dbTotal} db.payments=${dbPaid}`)
  expect(dbTotal, 'la venta debe guardar el total que vio el cajero (6.60)').toBe(6.6)
})

test('d) DESCUENTO global 10% en 2 líneas: total pantalla == DB al centavo', async ({ page }) => {
  await abrirPos(page)
  for (const n of ['Simple', 'SinDivisa']) {
    await buscar(page, N(n))
    await page.getByTestId('product-card').filter({ hasText: N(n) }).first().click()
  }
  await page.getByRole('button', { name: 'Descuento', exact: true }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Porcentaje de descuento').fill('10')
  for (let i = 0; i < 4; i++) await dlg.getByLabel(`Dígito ${i + 1} del PIN`).fill(String(i + 1))
  await dlg.getByRole('button', { name: 'Aplicar descuento' }).click()
  await expect(dlg).toBeHidden({ timeout: 15_000 })
  const ui = (await page.locator('[class*="totalUsdValue"]').textContent()) ?? ''
  const r = await cobrarUnMetodo(page, 'Efectivo USD')
  const v = ultimaVenta()
  console.log(`DESCUENTO ui=${ui.trim()} db=${sql(`SELECT total_usd FROM sales WHERE id=${v}`)} cobro=${r.uiTotalUsd.trim()}`)
  expect(Number(sql(`SELECT total_usd FROM sales WHERE id=${v}`))).toBeCloseTo(14.4, 2)
})

test('d) P0-2: descuento con PIN y DESPUÉS cargo: total pantalla == sales.total_usd == pagos − vuelto', async ({ page }) => {
  await abrirPos(page)
  for (const n of ['Simple', 'SinDivisa']) {
    await buscar(page, N(n))
    await page.getByTestId('product-card').filter({ hasText: N(n) }).first().click()
  }
  // 1) descuento 10% autorizado con PIN → crea la venta pendiente en el servidor (sin cargo)
  await page.getByRole('button', { name: 'Descuento', exact: true }).click()
  const dd = page.getByRole('dialog')
  await dd.getByLabel('Porcentaje de descuento').fill('10')
  for (let i = 0; i < 4; i++) await dd.getByLabel(`Dígito ${i + 1} del PIN`).fill(String(i + 1))
  await dd.getByRole('button', { name: 'Aplicar descuento' }).click()
  await expect(dd).toBeHidden({ timeout: 15_000 })
  // 2) cargo 10% DESPUÉS: 16 × 0.9 × 1.1 = 15.84
  await page.getByRole('button', { name: 'Cargo', exact: true }).click()
  const dc = page.getByRole('dialog')
  await dc.getByLabel('Porcentaje de cargo').fill('10')
  await dc.getByRole('button', { name: /Aplicar/ }).click()
  await expect(page.locator('[class*="totalUsdValue"]')).toContainText('15.84')
  // 3) cobrar: lo que ve el cajero == lo que guarda la venta == lo cobrado menos el vuelto
  const payReq = page.waitForRequest(rq => /\/api\/sales\/\d+\/pay$/.test(rq.url()) && rq.method() === 'PATCH')
  const r = await cobrarUnMetodo(page, 'Efectivo USD')
  const cuerpo = (await payReq).postData() ?? ''
  console.log(`P0-2 PATCH /pay body: ${cuerpo}`)
  expect(cuerpo, 'el cobro de la venta pendiente debe mandar el cargo vigente').toContain('"cargo_pct":10')
  const v = ultimaVenta()
  const dbTotal = Number(sql(`SELECT total_usd FROM sales WHERE id=${v}`))
  const neto = Number(sql(`SELECT ROUND(SUM(p.amount_usd) - s.vuelto_usd, 2) FROM sale_payments p JOIN sales s ON s.id = p.sale_id WHERE p.sale_id=${v}`))
  console.log(`P0-2 ui=${r.uiTotalUsd.trim()} db.total_usd=${dbTotal} pagos-vuelto=${neto}`)
  expect(r.uiTotalUsd).toContain('15.84')
  expect(dbTotal, 'la venta debe guardar descuento Y cargo').toBe(15.84)
  expect(neto, 'lo cobrado menos el vuelto debe ser el total').toBe(15.84)
})

test('b-c-k) talla M en modo Divisa: precio, price_source y stock propio de la talla', async ({ page }) => {
  const antesTalla = stockTalla(vid.M)
  const antesOtras = stockTalla(vid.S)
  await abrirPos(page)
  await buscar(page, N('Talla'))
  await page.getByTestId('product-card').filter({ hasText: N('Talla') }).first().click()
  await page.getByRole('dialog', { name: /Seleccionar variante/ }).getByRole('button', { name: /^M/ }).click()
  await expect(page.locator('[class*="totalUsdValue"]')).toContainText('40.00')
  await page.getByRole('radio', { name: /Divisa/ }).click()
  await expect(page.locator('[class*="totalUsdValue"]')).toContainText('30.00')
  await page.screenshot({ path: 'tests/__capturas__/cert-c-divisa-1280.png' })
  await cobrarUnMetodo(page, 'Efectivo USD')
  const v = ultimaVenta()
  expect(sql(`SELECT price_source FROM sale_items WHERE sale_id=${v}`)).toBe('divisa')
  expect(Number(sql(`SELECT price_per_unit_usd FROM sale_items WHERE sale_id=${v}`))).toBe(30)
  expect(Number(sql(`SELECT variant_id FROM sale_items WHERE sale_id=${v}`))).toBe(vid.M)
  expect(stockTalla(vid.M)).toBe(antesTalla - 1)
  expect(stockTalla(vid.S)).toBe(antesOtras)
})

test('c) producto sin precio Divisa en modo Divisa: cae a BCV (fallback_bcv en DB)', async () => {
  const r = await admin.post('/api/sales', {
    data: {
      items: [{ product_id: id.sinDivisa, quantity: 1, sale_mode: 'unit', discount_usd: 0 }],
      status: 'paid', origin: 'pos', price_mode: 'divisa',
      payments: [{ payment_method_id: Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='Efectivo USD'`)), amount_usd: 6, amount_bs: 6000 }],
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  const sid = ((await r.json()) as { sale: { id: number } }).sale.id
  sales.push(sid)
  expect(sql(`SELECT price_source FROM sale_items WHERE sale_id=${sid}`)).toBe('fallback_bcv')
})

test('i) devolución de una venta con talla repone el stock de ESA talla', async () => {
  const sid = Number(sql(`SELECT si.sale_id FROM sale_items si WHERE si.variant_id=${vid.M} ORDER BY si.id DESC LIMIT 1`))
  const itemId = Number(sql(`SELECT id FROM sale_items WHERE sale_id=${sid} AND variant_id=${vid.M}`))
  const antes = stockTalla(vid.M)
  const metodo = Number(sql(`SELECT id FROM payment_methods WHERE business_id=${BID} AND name='Efectivo USD'`))
  const r = await admin.post('/api/returns', {
    data: { sale_id: sid, reason: 'cert-pos', restores_stock: true, refund_payment_method_id: metodo, items: [{ product_id: id.talla, qty: 1, sale_item_id: itemId }] },
  })
  expect(r.status(), await r.text()).toBe(201)
  expect(stockTalla(vid.M)).toBe(antes + 1)
})

test('f-g) documentos impresos: ticket de venta (servidor) y cotización (cliente)', async ({ page }) => {
  const sid = sales[sales.length - 1]
  const html = await (await admin.get(`/api/sales/${sid}/ticket`)).text()
  // El nombre sale de la DB (no se compara con un literal): el ticket del servidor ya trae el negocio real.
  expect(html).toContain(sql(`SELECT name FROM businesses WHERE id=${BID}`))
  // P1-1: la talla sale impresa en la línea (antes dos tallas del mismo producto salían iguales)
  const tallaSid = Number(sql(`SELECT si.sale_id FROM sale_items si WHERE si.variant_id=${vid.M} ORDER BY si.id DESC LIMIT 1`))
  const tallaTxt = (await (await admin.get(`/api/sales/${tallaSid}/ticket`)).text()).replace(/<[^>]+>/g, ' ')
  expect(tallaTxt, 'la talla M debe salir en la línea del ticket').toMatch(/ZZ Cert Talla[^\n]*\bM\b/)
  // La cotización impresa (datos del negocio, usuario, número y talla) la cubre tests/pos-cotizacion.spec.ts leyendo el HTML.
  void page
})

test('7) costo visible al cajero en /api/products/search y /api/products/[id]/variants', async () => {
  const s = await (await cashier.get(`/api/products/search?q=${encodeURIComponent(N('Simple'))}`)).text()
  const v = await (await cashier.get(`/api/products/${id.talla}/variants`)).text()
  // El campo puede venir, pero redactado (null): mismo criterio que GET /api/products. Ningún valor de costo llega al cajero.
  const sj = JSON.parse(s) as { products: Array<{ cost_per_unit_usd: number | null }> }
  const vj = JSON.parse(v) as { variants: Array<{ cost_usd: number | null }> }
  expect(sj.products.length).toBeGreaterThan(0)
  expect(vj.variants.length).toBeGreaterThan(0)
  expect(sj.products.every(p => p.cost_per_unit_usd == null), 'search no debe dar costo al cajero').toBe(true)
  expect(vj.variants.every(x => x.cost_usd == null), 'variants no debe dar costo al cajero').toBe(true)
  // El admin sí recibe el costo del producto
  const sa = JSON.parse(await (await admin.get(`/api/products/search?q=${encodeURIComponent(N('Simple'))}`)).text()) as { products: Array<{ cost_per_unit_usd: number | null }> }
  expect(sa.products[0].cost_per_unit_usd, 'el admin debe seguir viendo el costo').not.toBeNull()
})

test('j) cierre: ventas del recorrido == reports/daily', async () => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
  const rep = (await (await admin.get(`/api/reports/daily?date=${hoy}`)).json()) as { total_usd: number }
  const db = Number(sql(`SELECT COALESCE(SUM(total_usd),0) FROM sales WHERE business_id=${BID} AND status IN ('paid','partial_return') AND DATE(CONVERT_TZ(sold_at,'+00:00','-04:00'))='${hoy}'`))
  const ret = Number(sql(`SELECT COALESCE(SUM(total_usd),0) FROM returns WHERE business_id=${BID} AND status='approved' AND DATE(CONVERT_TZ(created_at,'+00:00','-04:00'))='${hoy}'`))
  console.log(`CIERRE reports/daily=${rep.total_usd} sql.bruto=${db} sql.devol=${ret}`)
  expect(rep.total_usd).toBeCloseTo(db - ret, 2)
})
