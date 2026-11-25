import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { buildQuotationHtml, docFromQuotation, docFromTicket, sumLines } from '@/lib/quotation-document'
import { businessDateKey, shiftDateKey } from '@/lib/business-day'
import type { QuotationDocBusiness, QuotationDocSource } from '@/types/quotation-document'

/**
 * Documento ÚNICO de cotización (solo USD) + flujos del módulo /cotizaciones y de Ventas con clics reales.
 * Negocio 80 / admin 79 (servidor local en E2E_BASE_URL, por defecto :3000). Todo dato de prueba lleva "ZZ Doc"
 * en notas o nombre y se borra al final.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BID = 80
const ADMIN_ID = 79
const TAG = 'ZZ Doc'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })

const BIZ: QuotationDocBusiness = {
  name: 'ONBIKE Margarita', rif: '', address: 'C.C. La Redoma', phone: '04143954211', email: '',
}
const REFERENCIA: QuotationDocSource = {
  number: 'ACT-00305', created_at: '2026-11-24T15:00:00Z', valid_until: '2026-12-01', notes: null,
  client: null, total_usd: 21266,
  items: [
    { name: 'Garmin Fénix® 8 Solar - 51mm', qty: 9, price_usd: 1290 },
    { name: 'Garmin Fénix® 9 PRO - 51mm', qty: 4, price_usd: 1499 },
    { name: 'Garmin Forerunner® 570 - 47mm', qty: 6, price_usd: 610 },
  ],
}
const ctx = { business: BIZ, attendedBy: 'Daniel Cheein' }

/* ───────────── Documento (puro, sin servidor) ───────────── */

test.describe('documento único', () => {
  test('datos de la referencia: líneas y total sumado, sin Bs ni Tasa', () => {
    const html = buildQuotationHtml(docFromQuotation(REFERENCIA, ctx))
    for (const t of ['$11,610.00', '$5,996.00', '$3,660.00', 'Total $21,266.00', '9 und', '$1,290.00', 'N&deg; ACT-00305']) {
      expect(html, t).toContain(t)
    }
    expect(html).not.toMatch(/\bBs\b/)
    expect(html).not.toMatch(/tasa/i)
    expect(html).not.toMatch(/referencial/i)
    expect(html).toContain('V&aacute;lida hasta: 01/12/2026')
    expect(html).toContain('Atendido por: Daniel Cheein')
  })

  test('el total es la suma de líneas aunque la fuente traiga otro', () => {
    const doc = docFromQuotation({ ...REFERENCIA, total_usd: 99999 }, ctx)
    expect(sumLines(doc.lines)).toBe(21266)
    const html = buildQuotationHtml(doc)
    expect(html).toContain('Total $21,266.00')
    expect(html).not.toContain('99,999')
  })

  test('RIF vacío no imprime "RIF"; con RIF sí; el correo solo si existe', () => {
    const sin = buildQuotationHtml(docFromQuotation(REFERENCIA, ctx))
    expect(sin).not.toContain('RIF')
    expect(sin).not.toContain('Correo')
    const con = buildQuotationHtml(docFromQuotation(REFERENCIA, {
      ...ctx, business: { ...BIZ, rif: 'J-12345678-9', email: 'hola@onbike.test' },
    }))
    expect(con).toContain('RIF: J-12345678-9')
    expect(con).toContain('Correo: hola@onbike.test')
  })

  test('mismo HTML desde el POS y desde el módulo (misma función, mismas líneas)', () => {
    const hoy = new Date()
    const ymd = shiftDateKey(businessDateKey(hoy), 7)
    const desdeModulo = buildQuotationHtml(docFromQuotation({
      ...REFERENCIA, number: 'ACT-1', created_at: hoy.toISOString(), valid_until: ymd, total_usd: 21266,
    }, ctx))
    const desdePos = buildQuotationHtml(docFromTicket({
      client_name: null,
      items: REFERENCIA.items.map((i, n) => ({
        product_id: n + 1, product_name: i.name, sale_mode: 'unit', unit_label: 'und', quantity: i.qty,
        price_per_unit_usd: i.price_usd, cost_per_unit_usd: 0, subtotal_usd: i.qty * i.price_usd, subtotal_bs: 0,
        rate_used: 1, discount_usd: 0, precio_extra_usd: 0,
      })),
    }, 21266, { validityDays: 7, notes: '', number: 'ACT-1' }, ctx))
    expect(desdePos).toBe(desdeModulo)
  })

  test('cotización creada después de las 8 p. m. (Caracas) lleva la fecha correcta', () => {
    // 21:30 del 24/11 en Caracas = 01:30 UTC del 25/11: toISOString().slice daría el día siguiente.
    const html = buildQuotationHtml(docFromQuotation({ ...REFERENCIA, created_at: '2026-11-25T01:30:00Z' }, ctx))
    expect(html).toContain('<div class="gray">24/11/2026</div>')
    expect(html).not.toContain('25/11/2026')
  })

  test('pie: el del negocio manda; sin él, la vigencia; vacíos fuera', () => {
    const conFooter = buildQuotationHtml(docFromQuotation(REFERENCIA, { ...ctx, business: { ...BIZ, footer: 'Precios sujetos a stock.' } }))
    expect(conFooter).toContain('Precios sujetos a stock.')
    expect(conFooter).not.toContain('Esta cotización')
    const sinFooter = buildQuotationHtml(docFromQuotation(REFERENCIA, ctx))
    expect(sinFooter).toContain('Esta cotización es válida por 7 días contados desde su fecha de emisión.')
    expect(sinFooter).toContain('ONBIKE Margarita · Tel. 04143954211 · C.C. La Redoma')
  })

  test('25 líneas: el pie fijo no pisa filas (espaciador repetido ≥ alto del pie) y hay 2+ páginas', async ({ page }) => {
    const muchas: QuotationDocSource = {
      ...REFERENCIA,
      items: Array.from({ length: 25 }, (_, n) => ({ name: `Producto de prueba ${n + 1}`, qty: 1, price_usd: 10 + n })),
    }
    const html = buildQuotationHtml(docFromQuotation(muchas, ctx))
    await page.setContent(html)
    await page.emulateMedia({ media: 'print' })
    const g = await page.evaluate(() => {
      const foot = document.querySelector('.foot') as HTMLElement
      const spacer = document.querySelector('.spacer') as HTMLElement
      const tfoot = document.querySelector('.sheet > tfoot') as HTMLElement
      return {
        pos: getComputedStyle(foot).position,
        bottom: getComputedStyle(foot).bottom,
        footH: foot.getBoundingClientRect().height,
        spacerH: spacer.getBoundingClientRect().height,
        tfootDisplay: getComputedStyle(tfoot).display,
      }
    })
    expect(g.pos).toBe('fixed')
    expect(g.bottom).toBe('0px')
    expect(g.tfootDisplay).toBe('table-footer-group')
    expect(g.spacerH).toBeGreaterThanOrEqual(g.footH)
    const pdf = await page.pdf({ format: 'Letter', printBackground: true })
    const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(paginas).toBeGreaterThanOrEqual(2)
  })
})

/* ───────────── Módulo /cotizaciones y Ventas (clics reales) ───────────── */

let api: APIRequestContext
let abriCaja = false
let productId = 0
let cookieToken = ''

const token = (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

interface Made { id: number; number: string }
type Item = { name: string; qty: number; price_usd: number; product_id?: number }

async function mk(items: Item[], status?: string): Promise<Made> {
  const r = await api.post('/api/quotations', { data: { notes: TAG, items } })
  expect(r.status(), await r.text()).toBe(201)
  const q = (await r.json()).quotation as Made
  if (status) {
    const p = await api.patch(`/api/quotations/${q.id}`, { data: { status } })
    expect(p.status(), await p.text()).toBe(200)
  }
  return q
}

function cleanup(): void {
  sql(`DELETE qi FROM quotation_items qi JOIN quotations q ON q.id=qi.quotation_id WHERE q.business_id=${BID} AND q.notes LIKE '${TAG}%'`)
  sql(`DELETE FROM quotations WHERE business_id=${BID} AND notes LIKE '${TAG}%'`)
  const sales = sql(`SELECT id FROM sales WHERE business_id=${BID} AND notes LIKE '${TAG}%'`).split('\n').filter(Boolean).join(',')
  if (sales) {
    sql(`DELETE FROM sale_items WHERE sale_id IN (${sales})`)
    sql(`DELETE FROM sales WHERE id IN (${sales})`)
  }
  const ids = sql(`SELECT id FROM products WHERE business_id=${BID} AND name LIKE '${TAG}%'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BID} AND id IN (${ids})`)
  }
}

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

async function entrar(page: Page, ruta: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await capturarImpresion(page)
  await page.context().addCookies([{ name: 'activopos_session', value: cookieToken, url: BASE }])
  await page.goto(ruta)
}

const fila = (page: Page, numero: string) => page.getByRole('row').filter({ hasText: numero })

test.describe('módulo y ventas con clics reales', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    cleanup()
    cookieToken = await token()
    api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${cookieToken}` } })
    if (Number(sql(`SELECT COUNT(*) FROM cash_registers WHERE business_id=${BID} AND closed_at IS NULL`)) === 0) {
      const open = await api.post('/api/cash/open', { data: { opening_amount_usd: 0, opening_amount_bs: 0 } })
      expect(open.status(), await open.text()).toBe(201)
      abriCaja = true
    }
    const p = await api.post('/api/products', {
      data: { name: `${TAG} producto`, cost_per_unit_usd: 5, price_per_unit_usd: 10, is_fixed_price: true, stock_quantity: 50 },
    })
    expect(p.status(), await p.text()).toBe(201)
    productId = (await p.json()).product.id as number
  })

  test.afterAll(async () => {
    cleanup()
    if (abriCaja && api) await api.post('/api/cash/close', { data: { closing_amount_usd: 0, closing_amount_bs: 0, close_notes: `${TAG} prueba` } })
    await api?.dispose()
  })

  test('API: vigencia anterior a hoy responde 422 claro (POST y PATCH)', async () => {
    const malo = await api.post('/api/quotations', { data: { valid_until: '2020-01-01', items: [{ name: `${TAG} x`, qty: 1, price_usd: 1 }] } })
    expect(malo.status()).toBe(422)
    expect((await malo.json()).error).toContain('anterior a hoy')
    const q = await mk([{ name: `${TAG} x`, qty: 1, price_usd: 1 }])
    const p = await api.patch(`/api/quotations/${q.id}`, { data: { valid_until: '2020-01-01' } })
    expect(p.status()).toBe(422)
  })

  test('borrador: se puede descargar y el documento es el único (sin Bs)', async ({ page }) => {
    const q = await mk([{ name: `${TAG} borrador`, qty: 2, price_usd: 10 }])
    await entrar(page, '/cotizaciones')
    const btn = fila(page, q.number).getByRole('button', { name: `Descargar PDF de cotización ${q.number}` })
    await expect(btn).toBeEnabled({ timeout: 20_000 })
    await btn.click()
    await expect.poll(() => htmlImpreso(page).then(h => h.length)).toBeGreaterThan(0)
    const html = await htmlImpreso(page)
    expect(html).toContain(`N&deg; ${q.number}`)
    expect(html).toContain('Total $20.00')
    expect(html).toContain('Atendido por: Admin Demo')
    expect(html).not.toMatch(/\bBs\b/)
    await page.screenshot({ path: 'tests/__capturas__/cotizacion-lista-1440.png' })
  })

  test('enviada: se edita desde la lista, se valida la vigencia y se guarda y descarga', async ({ page }) => {
    const q = await mk([{ name: `${TAG} enviada`, qty: 2, price_usd: 10 }], 'sent')
    await entrar(page, '/cotizaciones')
    await fila(page, q.number).getByRole('button', { name: `Editar cotización ${q.number}` }).click()
    await expect(page).toHaveURL(new RegExp(`/cotizaciones/${q.id}/editar`))
    await expect(page.getByLabel('Descripción del ítem')).toHaveValue(`${TAG} enviada`)
    await expect(page.getByText(/Tasa|Equivalente|referencial/)).toHaveCount(0)

    // vigencia anterior a hoy: aviso en el campo y guardado bloqueado
    await page.getByLabel('Válida hasta').fill('2020-01-01')
    await expect(page.getByRole('alert').filter({ hasText: 'anterior a hoy' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
    await page.getByLabel('Días de vigencia').fill('10')
    await expect(page.getByRole('alert').filter({ hasText: 'anterior a hoy' })).toHaveCount(0)

    await page.getByLabel('Cantidad').fill('3')
    await page.screenshot({ path: 'tests/__capturas__/cotizacion-editor-1440.png' })
    await page.getByRole('button', { name: 'Vista previa' }).click()
    await expect.poll(() => htmlImpreso(page).then(h => h.length)).toBeGreaterThan(0)
    expect(await htmlImpreso(page)).toContain('Total $30.00')

    await page.getByRole('button', { name: 'Guardar y descargar' }).click()
    await expect(page).toHaveURL(/\/cotizaciones$/, { timeout: 20_000 })
    const get = await (await api.get(`/api/quotations/${q.id}`)).json()
    expect(get.quotation.status).toBe('sent')
    expect(get.quotation.items[0].qty).toBe(3)
    expect(get.quotation.valid_until.slice(0, 10)).toBe(shiftDateKey(businessDateKey(), 10))
    expect(await htmlImpreso(page)).toContain('Total $30.00')
  })

  test('aceptada: "Duplicar como nueva" crea un borrador con los mismos ítems y número nuevo', async ({ page }) => {
    const q = await mk([{ name: `${TAG} aceptada`, qty: 4, price_usd: 25, product_id: productId }], 'accepted')
    await entrar(page, '/cotizaciones')
    await expect(fila(page, q.number).getByRole('button', { name: `Cobrar cotización ${q.number}` })).toBeEnabled({ timeout: 20_000 })
    await fila(page, q.number).getByRole('button', { name: `Duplicar cotización ${q.number} como nueva` }).click()
    await expect(page).toHaveURL(/\/cotizaciones\/\d+\/editar/, { timeout: 20_000 })
    const nuevoId = Number(page.url().match(/cotizaciones\/(\d+)\/editar/)?.[1])
    expect(nuevoId).not.toBe(q.id)
    const nuevo = (await (await api.get(`/api/quotations/${nuevoId}`)).json()).quotation
    expect(nuevo.number).not.toBe(q.number)
    expect(nuevo.status).toBe('draft')
    expect(nuevo.items).toHaveLength(1)
    expect(nuevo.items[0]).toMatchObject({ name: `${TAG} aceptada`, qty: 4, price_usd: 25, product_id: productId })
    expect(nuevo.valid_until.slice(0, 10) >= businessDateKey()).toBe(true)
  })

  test('vencida: avisa que venció y ofrece "Duplicar como nueva"', async ({ page }) => {
    const q = await mk([{ name: `${TAG} vencida`, qty: 1, price_usd: 7 }], 'expired')
    await entrar(page, '/cotizaciones')
    const f = fila(page, q.number)
    await expect(f.getByText(/Venció/)).toBeVisible({ timeout: 20_000 })
    await expect(f.getByRole('button', { name: `Descargar PDF de cotización ${q.number}` })).toBeEnabled()
    await f.getByRole('button', { name: `Duplicar cotización ${q.number} como nueva` }).click()
    await expect(page).toHaveURL(/\/cotizaciones\/\d+\/editar/, { timeout: 20_000 })
    await expect(page.getByLabel('Descripción del ítem')).toHaveValue(`${TAG} vencida`)
  })

  test('aceptada con ítem manual: "Cobrar" deshabilitado con el motivo visible', async ({ page }) => {
    const q = await mk([{ name: `${TAG} manual`, qty: 1, price_usd: 9 }], 'accepted')
    await entrar(page, '/cotizaciones')
    const f = fila(page, q.number)
    await expect(f.getByRole('button', { name: new RegExp(`Cobrar cotización ${q.number} no disponible`) })).toBeDisabled({ timeout: 20_000 })
    await expect(f.getByText('Tiene ítems sin producto: conviértelos a un producto o crea la venta en el POS')).toBeVisible()
    await page.screenshot({ path: 'tests/__capturas__/cotizacion-bloqueada-1440.png' })
  })

  test('Ventas: cotización del POS → "Descargar cotización" reconstruye el documento único (sin vigencia guardada)', async ({ page }) => {
    const r = await api.post('/api/sales', {
      data: { status: 'quote', origin: 'quote', notes: TAG, items: [{ product_id: productId, quantity: 3, sale_mode: 'unit' }] },
    })
    expect(r.status(), await r.text()).toBe(201)
    const numero = sql(`SELECT ticket_number FROM sales WHERE business_id=${BID} AND notes='${TAG}' ORDER BY id DESC LIMIT 1`)
    await entrar(page, '/ventas')
    await page.getByText(numero).first().click()
    const btn = page.getByRole('button', { name: 'Descargar cotización' })
    await expect(btn).toBeEnabled({ timeout: 20_000 })
    await btn.click()
    await expect.poll(() => htmlImpreso(page).then(h => h.length)).toBeGreaterThan(0)
    const html = await htmlImpreso(page)
    expect(html).toContain(`N&deg; ${numero}`)
    expect(html).toContain('Total $30.00')
    expect(html).toContain(`${TAG} producto`)
    expect(html).not.toMatch(/\bBs\b/)
    expect(html).not.toContain('V&aacute;lida hasta')
    await page.screenshot({ path: 'tests/__capturas__/cotizacion-ventas-1440.png' })
  })
})
