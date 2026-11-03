import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'

/**
 * POS móvil (< 768 px), viewport 375×812. Negocio 80, servidor local, datos ZZ con limpieza.
 *   P con tallas T1/T2 (BCV 100, Divisa 80) · Q sin talla (BCV 30, Divisa 24).
 * Flujo: grid sin scroll horizontal → agregar P (talla) y Q → barra con N y total → hoja → +/−/eliminar →
 * Divisa cambia el total → "⋯ Más" abre descuento → cobrar y comparar sales.total_usd con lo mostrado.
 * También: el (?) no existe en /pos móvil y a 1280 px el POS conserva su layout de escritorio.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-7)
const NAME_P = `ZZ PosMov P ${TAG}`
const NAME_Q = `ZZ PosMov Q ${TAG}`
const SHOTS = path.join(__dirname, '__capturas__')
const usd = (n: number) => `$${n.toFixed(2)}`

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let api: APIRequestContext
let abriCaja = false
let metodoPago = ''
let maxSaleId = 0

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosMov%'`).split(/\r?\n/).filter(Boolean).join(',')
  if (!ids) return
  const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split(/\r?\n/).filter(Boolean).join(',')
  if (sales) {
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND id IN (${sales})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${ids})`)
}

test.beforeAll(async () => {
  cleanup()
  maxSaleId = Number(sql(`SELECT IFNULL(MAX(id),0) FROM sales WHERE business_id=${BUSINESS_ID}`))
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BUSINESS_ID} AND closed_at IS NULL`)) === 0) {
    const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  const methods = (await (await api.get('/api/payment-methods')).json()) as { methods?: Array<{ name: string }>; payment_methods?: Array<{ name: string }> }
  metodoPago = (methods.methods ?? methods.payment_methods ?? [])[0]?.name ?? ''
  expect(metodoPago, 'el negocio 80 necesita un método de pago').not.toBe('')

  const p = await api.post('/api/products', {
    data: {
      name: NAME_P, cost_per_unit_usd: 10, price_per_unit_usd: 100, wholesale_price_usd: 80, is_fixed_price: true, stock_quantity: 0, has_variants: true,
      variants: ['T1', 'T2'].map(valor => ({ tipo: 'talla', valor, stock: 10 })),
    },
  })
  expect(p.status(), await p.text()).toBe(201)
  const q = await api.post('/api/products', {
    data: { name: NAME_Q, cost_per_unit_usd: 5, price_per_unit_usd: 30, wholesale_price_usd: 24, is_fixed_price: true, stock_quantity: 10 },
  })
  expect(q.status(), await q.text()).toBe(201)
})

test.afterAll(async () => {
  cleanup()
  // "+ Nuevo" crea borradores vacíos en la DB: se quitan los que creó esta prueba
  sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND status='draft' AND id>${maxSaleId} AND id NOT IN (SELECT sale_id FROM sale_items)`)
  if (abriCaja && api) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ prueba pos-movil' } })
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosMov%'`))).toBe(0)
})

const card = (page: Page, name: string) => page.getByTestId('product-card').filter({ hasText: name }).first()
const lineas = (page: Page) => page.getByTestId('ticket-line')
const hoja = (page: Page) => page.getByTestId('pos-sheet')
const barra = (page: Page) => page.getByTestId('pos-cart-bar')
// Clic en la zona de los totales: el aviso "1 error" de Next dev (document is not defined en useHardwareScanner, SSR) tapa el centro-izquierda de la barra.
const abrirHoja = (page: Page) => page.getByRole('button', { name: /Ver carrito/ }).click({ position: { x: 220, y: 20 } })
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

async function entrar(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height })
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await page.getByPlaceholder('Buscar producto o código...').fill('ZZ PosMov ')
  await expect(card(page, NAME_P)).toBeVisible({ timeout: 60_000 })
}

test('móvil 375: grid, barra, hoja, líneas, Divisa, Más y cobro coherente con la DB', async ({ page }) => {
  await entrar(page, 375, 812)
  expect(await noHScroll(page), 'sin scroll horizontal en el grid').toBe(true)
  await expect(barra(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir ayuda' })).toHaveCount(0)
  await expect(hoja(page)).toBeHidden()

  // grid de 2 columnas: las dos tarjetas ZZ comparten fila
  const [bp, bq] = [await card(page, NAME_P).boundingBox(), await card(page, NAME_Q).boundingBox()]
  expect(bp && bq && Math.abs(bp.y - bq.y) < 4 && bp.x !== bq.x, 'dos columnas').toBe(true)

  // agregar uno con talla y uno sin talla
  await card(page, NAME_P).click()
  await page.getByRole('dialog', { name: /Seleccionar variante/ }).getByRole('button', { name: /^T1/ }).click()
  await card(page, NAME_Q).click()
  await expect(barra(page)).toBeVisible()
  await expect(page.getByTestId('pos-cart-count')).toHaveText('2 artículos')
  await expect(page.getByTestId('pos-cart-usd')).toHaveText(usd(130))
  await expect(barra(page)).toContainText('Bs.')
  expect(await noHScroll(page), 'sin scroll horizontal con la barra').toBe(true)
  await page.screenshot({ path: path.join(SHOTS, 'pos-movil-grid-barra-375.png') })

  // abrir la hoja desde la barra
  await abrirHoja(page)
  await expect(hoja(page)).toBeVisible()
  await expect(lineas(page)).toHaveCount(2)
  await expect(hoja(page).getByRole('button', { name: /Nuevo/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Divisa/ })).toBeVisible()
  expect(await noHScroll(page), 'sin scroll horizontal en la hoja').toBe(true)
  await page.waitForTimeout(450) // termina el deslizamiento de la hoja
  await page.screenshot({ path: path.join(SHOTS, 'pos-movil-hoja-375.png') })

  // +, − y eliminar
  const total = hoja(page).locator('[class*="totalUsdValue"]')
  const q = lineas(page).filter({ hasText: NAME_Q })
  await q.getByRole('button', { name: 'Aumentar cantidad' }).click()
  await expect(total).toHaveText(usd(160))
  await q.getByRole('button', { name: 'Reducir cantidad' }).click()
  await expect(total).toHaveText(usd(130))
  await q.getByRole('button', { name: /^Eliminar/ }).click()
  await expect(lineas(page)).toHaveCount(1)
  await expect(total).toHaveText(usd(100))

  // cerrar la hoja con el botón y volver a agregar Q desde el grid
  await page.getByRole('button', { name: 'Cerrar ticket', exact: true }).click()
  await expect(hoja(page)).toBeHidden()
  await card(page, NAME_Q).click()
  await expect(page.getByTestId('pos-cart-count')).toHaveText('2 artículos')
  await abrirHoja(page)

  // Divisa cambia el total
  await expect(total).toHaveText(usd(130))
  await page.getByRole('radio', { name: /Divisa/ }).click()
  await expect(total).not.toHaveText(usd(130), { timeout: 15_000 })

  // ⋯ Más → Descuento abre el modal de descuento
  await page.getByRole('button', { name: /Más/ }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(6)
  await page.screenshot({ path: path.join(SHOTS, 'pos-movil-mas-375.png') })
  await page.getByRole('menuitem', { name: /Descuento/ }).click()
  await expect(page.getByRole('dialog', { name: /Descuento/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /Descuento/ })).toBeHidden()

  // cobrar: sales.total_usd == total en pantalla
  const mostrado = Number((await total.innerText()).replace('$', ''))
  expect(mostrado).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Procesar Pago' }).click()
  const dialog = page.getByRole('dialog', { name: 'Procesar Pago' })
  await expect(dialog).toBeVisible()
  await dialog.getByText(metodoPago, { exact: true }).first().click()
  await dialog.getByText('Confirmar Venta').click()
  await expect(page.getByText('¡Venta registrada!')).toBeVisible({ timeout: 20_000 })

  const venta = sql(`SELECT s.total_usd FROM sales s JOIN sale_items si ON si.sale_id=s.id
                     WHERE s.business_id=${BUSINESS_ID} AND s.status='paid' AND si.product_id IN
                     (SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ PosMov%') ORDER BY s.id DESC LIMIT 1`)
  expect(Number(venta)).toBeCloseTo(mostrado, 2)
})

test('móvil 375: ticket activo vacío con otra pestaña con ítems muestra "Tickets abiertos: N"; con todas vacías la barra se oculta', async ({ page }) => {
  await entrar(page, 375, 812)
  await card(page, NAME_Q).click()
  await expect(page.getByTestId('pos-cart-count')).toHaveText('1 artículo')
  await abrirHoja(page)
  await hoja(page).getByRole('button', { name: /Nuevo/ }).click()
  await expect(lineas(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar ticket', exact: true }).click()
  await expect(hoja(page)).toBeHidden()

  // activo vacío + otra pestaña con ítems: barra con el aviso, sin Cobrar
  await expect(barra(page)).toBeVisible()
  await expect(page.getByTestId('pos-cart-open-tickets')).toHaveText('Tickets abiertos: 1')
  await expect(barra(page).getByRole('button', { name: 'Cobrar' })).toHaveCount(0)
  expect(await noHScroll(page), 'sin scroll horizontal con el aviso').toBe(true)
  await page.screenshot({ path: path.join(SHOTS, 'pos-movil-tickets-abiertos-375.png') })

  // tocar la barra abre la hoja y desde ahí se llega al ticket con ítems
  await page.getByRole('button', { name: /Ver tickets abiertos/ }).click()
  await expect(hoja(page)).toBeVisible()
  await hoja(page).getByRole('tab', { name: /Ticket 1/ }).click()
  await expect(lineas(page)).toHaveCount(1)
  await expect(page.getByTestId('pos-cart-count')).toHaveText('1 artículo')

  // todas las pestañas vacías: la barra desaparece
  await lineas(page).first().getByRole('button', { name: /^Eliminar/ }).click()
  await expect(lineas(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar ticket', exact: true }).click()
  await expect(barra(page)).toHaveCount(0)
})

test('escritorio 1280: el POS conserva panel lateral, pestañas arriba, sin barra móvil y con ayuda', async ({ page }) => {
  await entrar(page, 1280, 800)
  await card(page, NAME_Q).click()
  await expect(lineas(page)).toHaveCount(1)
  await expect(barra(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir ayuda' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Procesar Pago' })).toBeVisible()
  const [ticket, grid] = [await lineas(page).first().boundingBox(), await card(page, NAME_P).boundingBox()]
  expect(ticket && grid && ticket.x > grid.x + grid.width, 'ticket a la derecha del grid').toBe(true)
  await page.screenshot({ path: path.join(SHOTS, 'pos-movil-escritorio-1280.png') })
})
