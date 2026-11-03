import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'

/**
 * P0-F1: la cotización impresa del POS lleva los datos REALES del negocio y del usuario, el número guardado y la talla.
 * Negocio 80. Se lee el HTML que se imprimiría interceptando URL.createObjectURL y window.open (la impresión abre un blob:).
 * Al final se restauran RIF, dirección y teléfono del negocio y se borran los datos ZZ.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const ADMIN_ID = 79
const TAG = String(Date.now()).slice(-6)
const NAME = `ZZ PosCot ${TAG}`
const RIF = 'J-ZZ99887766'
const DIR = 'ZZ Avenida Prueba 123'
const TEL = '0414-ZZ-5550000'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let abriCaja = false
let orig: { rif: string; address: string; phone: string; name: string }

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZ PosCot%'`).split('\n').filter(Boolean).join(',')
  if (!ids) return
  const sales = sql(`SELECT DISTINCT sale_id FROM sale_items WHERE product_id IN (${ids})`).split('\n').filter(Boolean).join(',')
  if (sales) {
    sql(`DELETE FROM sale_payments WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sales WHERE business_id=${BID} AND id IN (${sales})`)
  }
  sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
  sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
}

const esc = (s: string) => s.replace(/'/g, "''")
const sqlVal = (s: string) => (s ? `'${esc(s)}'` : 'NULL')

test.beforeAll(async () => {
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
    const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
    expect(open.status(), await open.text()).toBe(201)
    abriCaja = true
  }
  const [name, rif, address, phone] = sql(`SELECT CONCAT_WS('|', IFNULL(name,''), IFNULL(rif,''), IFNULL(address,''), IFNULL(phone,'')) FROM businesses WHERE id=${BID}`).split('|')
  orig = { name, rif, address, phone }
  sql(`UPDATE businesses SET rif='${RIF}', address='${DIR}', phone='${TEL}' WHERE id=${BID}`)
  const p = await api.post('/api/products', {
    data: { name: NAME, cost_per_unit_usd: 10, price_per_unit_usd: 100, is_fixed_price: true, stock_quantity: 0, has_variants: true, variants: [{ tipo: 'talla', valor: 'TCOT', stock: 10 }] },
  })
  expect(p.status(), await p.text()).toBe(201)
})

test.afterAll(async () => {
  cleanup()
  if (orig) sql(`UPDATE businesses SET rif=${sqlVal(orig.rif)}, address=${sqlVal(orig.address)}, phone=${sqlVal(orig.phone)} WHERE id=${BID}`)
  if (abriCaja && api) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: 'ZZ prueba pos-cotizacion' } })
  await api?.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BID} AND name LIKE 'ZZ PosCot%'`))).toBe(0)
})

/** Captura el HTML que el POS imprimiría: guarda cada Blob creado y evita abrir la ventana real. */
async function capturarImpresion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __blobs: Blob[] }
    w.__blobs = []
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (obj: Blob | MediaSource) => { if (obj instanceof Blob) w.__blobs.push(obj); return original(obj) }
    window.open = () => ({ print() {}, close() {}, addEventListener() {} }) as unknown as Window
  })
}

const htmlImpreso = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const w = window as unknown as { __blobs: Blob[] }
    const b = w.__blobs[w.__blobs.length - 1]
    return b ? await b.text() : ''
  })

async function abrirCotizacion(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await capturarImpresion(page)
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/pos')
  await page.getByPlaceholder('Buscar producto o código...').fill(NAME)
  await page.getByTestId('product-card').filter({ hasText: NAME }).first().click()
  await page.getByRole('dialog', { name: /Seleccionar variante/ }).getByRole('button', { name: /^TCOT/ }).click()
  await expect(page.getByTestId('ticket-line')).toHaveCount(1)
  await page.getByRole('button', { name: /Generar Cotización/ }).click()
  await expect(page.getByRole('dialog', { name: /Generar Cotización/ })).toBeVisible()
}

test('guardar e imprimir: datos reales del negocio, usuario, número guardado y talla; sin datos fijos', async ({ page }) => {
  await abrirCotizacion(page)
  await page.getByRole('button', { name: 'Guardar y imprimir' }).click()
  await expect.poll(() => htmlImpreso(page).then(h => h.length), { timeout: 20_000 }).toBeGreaterThan(0)
  const html = await htmlImpreso(page)
  const numero = sql(`SELECT s.ticket_number FROM sales s JOIN sale_items si ON si.sale_id=s.id JOIN products p ON p.id=si.product_id WHERE s.business_id=${BID} AND s.status='quote' AND p.name='${NAME}' ORDER BY s.id DESC LIMIT 1`)
  expect(numero, 'la cotización debe haberse guardado con número').not.toBe('')

  // datos reales del negocio (de la DB), usuario real y número guardado
  expect(html).toContain(orig.name)
  expect(html).toContain(`RIF: ${RIF}`)
  expect(html).toContain(DIR)
  expect(html).toContain(`Tel: ${TEL}`)
  expect(html).toContain('Atendido por: Admin Demo')
  expect(html).toContain(`N&deg; ${numero}`)
  // la talla en la línea
  expect(html).toContain(`${NAME} &mdash; TCOT`)
  // nada fijo
  expect(html).not.toContain('Mi Negocio')
  expect(html).not.toContain('Atendido por: Cajero')
  expect(html).not.toContain('Sistema de Punto de Venta')
  expect(html).not.toContain('Borrador')
})

test('solo imprimir (sin guardar): se rotula "Borrador (sin número)" y conserva los datos reales', async ({ page }) => {
  await abrirCotizacion(page)
  await page.getByRole('button', { name: 'Solo imprimir' }).click()
  await expect.poll(() => htmlImpreso(page).then(h => h.length), { timeout: 20_000 }).toBeGreaterThan(0)
  const html = await htmlImpreso(page)
  expect(html).toContain('Borrador (sin n&uacute;mero)')
  expect(html).toContain(`RIF: ${RIF}`)
  expect(html).toContain('Atendido por: Admin Demo')
  expect(html).not.toContain('Mi Negocio')
  expect(html).not.toContain('Sistema de Punto de Venta')
})
