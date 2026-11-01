import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import * as XLSX from 'xlsx'
import { envValue, sql } from './alta-helpers'
import path from 'path'

/**
 * UI de /metricas contra el servidor y la base local. Negocio 80; datos ZZ con fechas de 2001-04 (no chocan con ventas reales),
 * borrados al final. Cubre: cada pestaña, filtro de rango, orden con la fila "Ventas sin detalle de producto" siempre última,
 * buscador, clic en categoría/marca, crear/editar/eliminar meta, export .xlsx, estado de error, móvil 375 sin overflow y
 * estilos reales (getComputedStyle). Las capturas 1280/375 quedan en tests/__capturas__/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const FROM = '2001-04-01'
const TO = '2001-04-30'
const PERIOD = '2001-04'
const SIN_DETALLE = 'Ventas sin detalle de producto'
const SHOTS = path.join(__dirname, '__capturas__')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let api: APIRequestContext
let p1 = 0 // ZZ UI Hamburguesa (con marca)
let p2 = 0 // ZZ UI Refresco (sin marca)

const token = async (): Promise<string> =>
  new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))

function cleanup(): void {
  sql(`DELETE si FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.business_id=${BUSINESS_ID} AND s.ticket_number LIKE 'ZZU-%'`)
  sql(`DELETE FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number LIKE 'ZZU-%'`)
  sql(`DELETE FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='${PERIOD}'`)
  const ids = sql(`SELECT id FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ UI%'`).split('\n').filter(Boolean).join(',')
  if (ids) {
    sql(`DELETE FROM inventory_entries WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_variants WHERE product_id IN (${ids})`)
    sql(`DELETE FROM product_collections WHERE product_id IN (${ids})`)
    sql(`DELETE FROM products WHERE business_id=${BUSINESS_ID} AND id IN (${ids})`)
  }
  sql(`DELETE FROM brands WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ UI%'`)
}

function venta(ticket: string, totalUsd: number, totalBs: number, soldAtUtc: string, items: [number, number, number, number][]): void {
  sql(`INSERT INTO sales (business_id, cashier_id, ticket_number, status, total_usd, total_bs, rate_used, sold_at, updated_at)
       VALUES (${BUSINESS_ID}, ${ADMIN_ID}, '${ticket}', 'paid', ${totalUsd}, ${totalBs}, 100, '${soldAtUtc}', NOW(3))`)
  const saleId = Number(sql(`SELECT id FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number='${ticket}'`))
  for (const [pid, qty, usd, bs] of items) {
    sql(`INSERT INTO sale_items (sale_id, product_id, product_name, sale_mode, unit_label, quantity, price_per_unit_usd, subtotal_usd, subtotal_bs, rate_used)
         VALUES (${saleId}, ${pid}, 'ZZ UI', 'unit', 'und', ${qty}, ${usd / qty}, ${usd}, ${bs}, 100)`)
  }
}

test.beforeAll(async () => {
  cleanup()
  api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await token()}` } })
  const b = await api.post('/api/brands', { data: { name: 'ZZ UI Marca', search_term: 'zz ui' } })
  expect(b.status(), await b.text()).toBeLessThan(300)
  const brandId = Number(sql(`SELECT id FROM brands WHERE business_id=${BUSINESS_ID} AND name='ZZ UI Marca'`))
  const mk = async (name: string, brand?: number): Promise<number> => {
    const r = await api.post('/api/products', { data: { name, cost_per_unit_usd: 5, price_per_unit_usd: 10, stock_quantity: 20, ...(brand ? { brand_id: brand } : {}) } })
    expect(r.status(), await r.text()).toBe(201)
    return ((await r.json()) as { product: { id: number } }).product.id
  }
  p1 = await mk('ZZ UI Hamburguesa', brandId)
  p2 = await mk('ZZ UI Refresco')
  venta('ZZU-A', 56, 5600, '2001-04-10 16:00:00', [[p1, 5, 50, 5000], [p2, 2, 6, 600]])
  venta('ZZU-G', 25, 2500, '2001-04-20 16:00:00', []) // sin líneas: fila "Ventas sin detalle de producto"
  venta('ZZU-F', 20, 2000, '2001-03-15 16:00:00', [[p1, 2, 20, 2000]]) // período anterior
})

test.afterAll(async () => {
  cleanup()
  await api.dispose()
  expect(Number(sql(`SELECT COUNT(*) FROM sales WHERE business_id=${BUSINESS_ID} AND ticket_number LIKE 'ZZU-%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM products WHERE business_id=${BUSINESS_ID} AND name LIKE 'ZZ UI%'`))).toBe(0)
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='${PERIOD}'`))).toBe(0)
})

async function abrir(page: Page): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await token(), url: BASE }])
  await page.goto('/metricas')
  await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible()
}

async function rangoAbril(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Personalizado' }).click()
  await page.getByLabel('Desde').fill(FROM)
  await page.getByLabel('Hasta').fill(TO)
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })

test('productos: tabla con datos reales, sin detalle siempre última, orden y buscador', async ({ page }) => {
  await abrir(page)
  await rangoAbril(page)
  const tabla = page.getByTestId('metricas-tabla-productos')
  await expect(tabla.getByRole('row')).toHaveCount(4) // encabezado + 2 productos + sin detalle
  const filas = tabla.locator('tbody tr')
  await expect(filas.nth(0)).toContainText('ZZ UI Hamburguesa')
  await expect(filas.nth(0)).toContainText('$50.00')
  await expect(filas.nth(0)).toContainText('ZZ UI Marca')
  await expect(filas.nth(0)).toContainText('150%') // 5 unidades vs 2 del período anterior → ↑ 150%
  await expect(filas.nth(1)).toContainText('ZZ UI Refresco')
  await expect(filas.nth(2)).toContainText(SIN_DETALLE)
  await expect(filas.nth(2)).toContainText('—')
  await expect(page.getByTestId('metricas-resumen')).toContainText('$81.00') // 50 + 6 + 25

  // Orden por Unidades ascendente: el Refresco (2) sube y "sin detalle" sigue de última
  await tabla.getByRole('button', { name: /Unidades/ }).click()
  await tabla.getByRole('button', { name: /Unidades/ }).click()
  await expect(tabla.getByRole('columnheader', { name: /Unidades/ })).toHaveAttribute('aria-sort', 'ascending')
  await expect(filas.nth(0)).toContainText('ZZ UI Refresco')
  await expect(filas.nth(2)).toContainText(SIN_DETALLE)

  // Buscador: con q la fila sin detalle desaparece (contrato v1.2)
  await page.getByLabel('Buscar producto').fill('hambur')
  await expect(filas).toHaveCount(1)
  await expect(filas.nth(0)).toContainText('ZZ UI Hamburguesa')
  await page.getByLabel('Buscar producto').fill('zzzz-nada')
  await expect(page.getByTestId('metricas-vacio')).toContainText('No hay ventas con ese filtro')
})

test('categorías y marcas: ranking y clic filtra Productos', async ({ page }) => {
  await abrir(page)
  await rangoAbril(page)
  await tab(page, 'Categorías y marcas').click()
  await page.getByRole('button', { name: 'Marca', exact: true }).click()
  const ranking = page.getByTestId('metricas-ranking')
  await expect(ranking.getByText('ZZ UI Marca')).toBeVisible()
  await expect(ranking.getByText(SIN_DETALLE)).toBeVisible()
  await expect(ranking.getByText('Sin marca')).toBeVisible()
  await ranking.getByRole('button', { name: 'Ver productos de ZZ UI Marca' }).click()
  await expect(tab(page, 'Productos')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Quitar filtro Marca: ZZ UI Marca' })).toBeVisible()
  await expect(page.getByTestId('metricas-tabla-productos').locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'Quitar filtro Marca: ZZ UI Marca' }).click()
  await expect(page.getByTestId('metricas-tabla-productos').locator('tbody tr')).toHaveCount(3)
})

test('metas: crear, editar y eliminar con confirmación en la UI', async ({ page }) => {
  await abrir(page)
  await tab(page, 'Metas').click()
  await page.getByLabel('Mes de las metas').fill(PERIOD)
  await expect(page.getByTestId('metricas-vacio')).toContainText('Todavía no tienes metas este mes')

  await page.getByRole('button', { name: 'Nueva meta' }).click()
  const modal = page.getByTestId('metricas-modal-meta')
  await modal.getByLabel('Buscar producto').fill('ZZ UI Ham')
  await modal.getByRole('button', { name: 'ZZ UI Hamburguesa' }).click()
  await modal.getByLabel('Mes de la meta').fill(PERIOD)
  await modal.getByLabel('Objetivo de la meta').fill('400')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  const meta = page.getByTestId('metricas-meta')
  await expect(meta).toContainText('ZZ UI Hamburguesa')
  await expect(meta).toContainText('5 de 400')
  await expect(meta).toContainText('Mes cerrado') // abril de 2001 ya cerró
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='${PERIOD}' AND target=400`))).toBe(1)

  // Duplicada: mismo producto, mes y medida → mensaje claro (409)
  await page.getByRole('button', { name: 'Nueva meta' }).click()
  await modal.getByLabel('Buscar producto').fill('ZZ UI Ham')
  await modal.getByRole('button', { name: 'ZZ UI Hamburguesa' }).click()
  await modal.getByLabel('Mes de la meta').fill(PERIOD)
  await modal.getByLabel('Objetivo de la meta').fill('10')
  await page.getByRole('button', { name: 'Crear meta' }).click()
  await expect(modal.getByRole('alert')).toContainText('Ya tienes una meta igual')
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // Editar el objetivo
  await page.getByRole('button', { name: 'Editar meta de ZZ UI Hamburguesa' }).click()
  await modal.getByLabel('Objetivo de la meta').fill('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(meta).toContainText('5 de 5')
  await expect(meta).toContainText('Cumplida')
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='${PERIOD}' AND target=5`))).toBe(1)

  // Eliminar: pide confirmación dentro de la UI (sin window.confirm)
  page.on('dialog', d => { throw new Error(`no debe usar window.confirm: ${d.message()}`) })
  await page.getByRole('button', { name: 'Eliminar meta de ZZ UI Hamburguesa' }).click()
  await expect(page.getByText('¿Eliminar la meta de ZZ UI Hamburguesa?')).toBeVisible()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByTestId('metricas-vacio')).toBeVisible()
  expect(Number(sql(`SELECT COUNT(*) FROM sales_goals WHERE business_id=${BUSINESS_ID} AND period='${PERIOD}'`))).toBe(0)
})

test('exportar Excel descarga un .xlsx con los datos del rango', async ({ page }) => {
  await abrir(page)
  await rangoAbril(page)
  await expect(page.getByTestId('metricas-tabla-productos').locator('tbody tr')).toHaveCount(3)
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar Excel' }).click()])
  expect(descarga.suggestedFilename()).toBe(`metricas-products-${FROM}_a_${TO}.xlsx`)
  const wb = XLSX.readFile(await descarga.path() as string)
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
  expect(JSON.stringify(filas)).toContain('ZZ UI Hamburguesa')
  expect(JSON.stringify(filas)).toContain(SIN_DETALLE)
})

test('error real: si el endpoint falla, la vista muestra el error con Reintentar', async ({ page }) => {
  await page.route('**/api/metrics/products**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Error del servidor' }) }))
  await abrir(page)
  await expect(page.getByTestId('metricas-error')).toContainText('Error del servidor')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test('estilos reales: cards blancas de 16px con sombra sobre el fondo del dashboard', async ({ page }) => {
  await abrir(page)
  const card = page.locator('section[aria-label="Ventas por producto"]')
  await expect(card).toBeVisible()
  const css = await card.evaluate(el => {
    const s = getComputedStyle(el)
    let bg = ''
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      const b = getComputedStyle(n).backgroundColor
      if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') { bg = b; break }
    }
    return { background: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow, border: s.borderTopWidth, pad: `${s.paddingTop} ${s.paddingRight}`, pageBg: bg }
  })
  expect(css.background).toBe('rgb(255, 255, 255)')
  expect(css.radius).toBe('16px')
  expect(css.border).toBe('0px')
  expect(css.pad).toBe('20px 24px')
  expect(css.shadow).toContain('rgba(47, 43, 61, 0.1)')
  // Fondo del dashboard = --bg-base (#F0F0F7), el mismo de todos los módulos; #EEEDF4 del prompt es --mkt-section-b (marketing).
  expect(css.pageBg).toBe('rgb(240, 240, 247)')
})

for (const [nombre, ancho, alto] of [['1280', 1280, 800], ['375', 375, 800]] as const) {
  test(`capturas ${nombre}px de las 3 pestañas${ancho === 375 ? ' y sin overflow horizontal' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    await abrir(page)
    await rangoAbril(page)
    const sinOverflow = async (): Promise<void> => {
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(o, 'overflow horizontal de la página').toBeLessThanOrEqual(0)
    }
    await expect(page.getByTestId('metricas-tabla-productos')).toBeVisible()
    await sinOverflow()
    await page.screenshot({ path: path.join(SHOTS, `metricas-${nombre}-productos.png`) })
    await tab(page, 'Categorías y marcas').click()
    await expect(page.getByTestId('metricas-ranking')).toBeVisible()
    await sinOverflow()
    await page.screenshot({ path: path.join(SHOTS, `metricas-${nombre}-grupos.png`) })
    await tab(page, 'Metas').click()
    await page.getByLabel('Mes de las metas').fill(PERIOD)
    await expect(page.getByTestId('metricas-vacio')).toBeVisible()
    await sinOverflow()
    await page.screenshot({ path: path.join(SHOTS, `metricas-${nombre}-metas.png`) })
  })
}
