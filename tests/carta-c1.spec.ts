import { test, expect, type Browser, type Page } from '@playwright/test'
import { execFileSync } from 'child_process'
import path from 'path'
import { sql } from './alta-helpers'

/**
 * Plantilla Carta, fase C1 (SPEC §10 A1–A9, §12.8 y §13.5 E1–E13 que no dependen de C2). Negocio demo del seed
 * (scripts/seed-carta-demo.ts: 38 platos, 6 con tamaños). Todo lo que se toca se restaura al final: se vuelve a correr el seed
 * (idempotente) y se borran las ventas y pedidos ZZ. Fuera de C1: alérgenos y tiempo de preparación (E8), combos y "para compartir" (C2).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const SLUG = 'zzb-pruebas'
const URL_CARTA = '/catalogo-carta/' + SLUG
const ROOT = path.join(__dirname, '..')
const ALL_DAY = "JSON_ARRAY(JSON_ARRAY('00:00','23:59'))"
const OPEN = "JSON_OBJECT('lun'," + ALL_DAY + ",'mar'," + ALL_DAY + ",'mie'," + ALL_DAY + ",'jue'," + ALL_DAY + ",'vie'," + ALL_DAY + ",'sab'," + ALL_DAY + ",'dom'," + ALL_DAY + ')'
const CLOSED = "JSON_OBJECT('lun',JSON_ARRAY(),'mar',JSON_ARRAY(),'mie',JSON_ARRAY(),'jue',JSON_ARRAY(),'vie',JSON_ARRAY(),'sab',JSON_ARRAY(),'dom',JSON_ARRAY())"
const CON_FOTO = ['Cheez Burger Clásica Americana', 'Smash Burger', 'Pollo Crispy', 'Punta Burger', '4to Piso', 'Baconise Triple']

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const setSettings = (expr: string): void => { q("UPDATE businesses SET settings = " + expr + " WHERE id=@BID") }
const setKey = (key: string, valueExpr: string): void => setSettings("JSON_SET(COALESCE(settings, JSON_OBJECT()), '$." + key + "', " + valueExpr + ")")

function seed(): void {
  // Sin shell: node + el binario de ts-node, con argumentos fijos.
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', 'tests/tsconfig.json', 'scripts/seed-carta-demo.ts'], { cwd: ROOT, stdio: 'pipe' })
}

function limpiarZZ(): void {
  const orders = q("SELECT id FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %'").split('\n').filter(Boolean).join(',')
  if (orders) {
    q('DELETE FROM order_items WHERE order_id IN (' + orders + ')')
    q('DELETE FROM orders WHERE id IN (' + orders + ')')
  }
  q("DELETE FROM inventory_entries WHERE business_id=@BID AND notes LIKE 'Reserva pedido catálogo%'")
  q("DELETE FROM clients WHERE business_id=@BID AND name LIKE 'ZZB %'")
  const sales = q("SELECT id FROM sales WHERE business_id=@BID AND ticket_number LIKE 'ZZBCARTA%'").split('\n').filter(Boolean).join(',')
  if (sales) {
    q('DELETE FROM sale_items WHERE sale_id IN (' + sales + ')')
    q('DELETE FROM sales WHERE id IN (' + sales + ')')
  }
  q("DELETE FROM landing_sections WHERE business_id=@BID AND type='event_slider'")
}

function restaurar(): void {
  limpiarZZ()
  q("UPDATE products SET images=NULL, wholesale_price_usd=NULL WHERE business_id=@BID")
  setSettings("JSON_REMOVE(COALESCE(settings, JSON_OBJECT()), '$.carta_paused')")
  seed()
}

test.beforeAll(() => {
  seed()
  bid = Number(sql("SELECT id FROM businesses WHERE catalog_slug='" + SLUG + "'"))
  limpiarZZ()
  q('UPDATE products SET images=\'["/brand/cashea.png"]\' WHERE business_id=@BID AND name IN (' + CON_FOTO.map(n => "'" + n + "'").join(',') + ')')
  setKey('carta_hours', OPEN)
})

test.afterAll(() => {
  restaurar()
  expect(Number(q("SELECT COUNT(*) FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB %'"))).toBe(0)
  expect(Number(q("SELECT COUNT(*) FROM sales WHERE business_id=@BID AND ticket_number LIKE 'ZZBCARTA%'"))).toBe(0)
  expect(Number(q("SELECT COUNT(*) FROM landing_sections WHERE business_id=@BID AND type='event_slider'"))).toBe(0)
})

const sinScrollHorizontal = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
const cuenta = async (page: Page): Promise<number> => Number(await page.getByTestId('carta-barra-cantidad').innerText())
const plato = (page: Page, nombre: string) => page.getByTestId('carta-plato').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
const idPlato = (nombre: string): number => Number(q("SELECT id FROM products WHERE business_id=@BID AND name='" + nombre + "'"))

async function contextoReducido(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE, reducedMotion: 'reduce' })
  return ctx.newPage()
}

test('A1 solo abre con catalog_template=carta; otra plantilla responde 404 y el premium no sirve este negocio', async ({ request }) => {
  expect((await request.get(URL_CARTA)).status()).toBe(200)
  expect((await request.get('/catalogo-carta/boutique-demo')).status()).toBe(404)
  expect((await request.get('/catalogo-premium/' + SLUG)).status()).toBe(404)
  expect((await request.get(URL_CARTA + '/p/999999')).status()).toBe(404)
})

test('A2 portada: Abierto, Cerrado y pedidos en pausa según el horario (hora de Caracas)', async ({ page }) => {
  await page.goto(URL_CARTA)
  await expect(page.getByTestId('carta-estado')).toContainText('Abierto')
  setKey('carta_hours', CLOSED)
  await page.reload()
  await expect(page.getByTestId('carta-estado')).toContainText('Cerrado')
  setKey('carta_hours', OPEN)
  setKey('carta_paused', 'true')
  await page.reload()
  await expect(page.getByTestId('carta-estado')).toContainText('Pedidos en pausa')
  setSettings("JSON_REMOVE(settings, '$.carta_paused')")
  await page.reload()
  await expect(page.getByTestId('carta-estado')).toContainText('Abierto')
})

test('A3 pestañas: al tocar una se llega a su sección y queda activa; con scroll la activa cambia (scroll-spy)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL_CARTA)
  const tabs = page.locator('[data-testid^="carta-tab-"]')
  expect(await tabs.count()).toBeGreaterThanOrEqual(8)
  await tabs.nth(3).click()
  await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true')
  const seccion = page.locator('#cat-3')
  await expect.poll(async () => (await seccion.boundingBox())?.y ?? 9999, { timeout: 5000 }).toBeLessThan(260)
  await page.evaluate(() => document.getElementById('cat-6')?.scrollIntoView({ block: 'start' }))
  await expect(tabs.nth(6)).toHaveAttribute('aria-selected', 'true')
  // la barra (buscador + pestañas) queda fija arriba mientras se hace scroll
  const barra = await page.getByTestId('carta-tabs').boundingBox()
  expect(barra?.y ?? 9999).toBeGreaterThanOrEqual(0)
  expect(barra?.y ?? 9999).toBeLessThan(130)
})

test('A4 / E6 buscador: nombre, ingrediente (rúgula) sin acentos ni mayúsculas, y sin resultados', async ({ page }) => {
  await page.goto(URL_CARTA)
  await page.getByTestId('carta-buscar-btn').click()
  const buscador = page.getByTestId('carta-buscador')
  await buscador.fill('RUGULA')
  await expect(plato(page, 'Cheez Burger Clásica Americana')).toBeVisible()
  expect(await page.getByTestId('carta-plato').count()).toBeLessThan(38)
  await buscador.fill('punta')
  await expect(plato(page, 'Punta Burger')).toBeVisible()
  await buscador.fill('zzzxyz')
  await expect(page.getByTestId('carta-sin-resultados')).toBeVisible()
})

test('A5 / E10 precio: $ grande + Bs pequeño, Divisa si aplica, "Desde" con tamaños y los pagos UNA vez (sin chips por plato)', async ({ page }) => {
  q("UPDATE products SET wholesale_price_usd=10 WHERE business_id=@BID AND name='Smash Burger'")
  await page.goto(URL_CARTA)
  const smash = plato(page, 'Smash Burger')
  await expect(smash.getByTestId('carta-plato-precio-usd')).toHaveText('$10.00')
  await expect(smash.getByTestId('carta-plato-precio-bs')).toContainText('Bs.')
  const normal = plato(page, 'Pollo Crispy')
  await expect(normal.getByTestId('carta-plato-precio-usd')).toHaveText('$10.00')
  const punta = plato(page, 'Punta Burger')
  await expect(punta).toContainText('Desde')
  await expect(punta.getByTestId('carta-plato-precio-usd')).toHaveText('$20.00')
  await expect(punta).toContainText('2 tamaños')
  const platos = await page.getByTestId('carta-plato').allInnerTexts()
  expect(platos.some(t => /Cashea|Divisa|Full/.test(t))).toBe(false)
  await expect(page.getByTestId('carta-franja-pago')).toHaveCount(1)
  await expect(page.getByTestId('carta-franja-pago')).toContainText('Cómo pagas')
  await expect(page.getByTestId('carta-franja-pago')).toContainText('Divisa')
  await expect(page.getByTestId('carta-franja-pago')).toContainText('tasa BCV')
})

test('plato "Consultar precio" (on_request): sin precio, sin botón de agregar y no se puede pedir desde la ficha', async ({ page }) => {
  q("UPDATE products SET catalog_visibility='on_request' WHERE business_id=@BID AND name='Smash Burger'")
  await page.goto(URL_CARTA)
  const smash = plato(page, 'Smash Burger')
  await expect(smash).toContainText('Consultar precio')
  await expect(smash.getByTestId('carta-plato-precio-usd')).toHaveCount(0)
  await expect(smash.getByTestId('carta-plato-agregar')).toHaveCount(0)
  await page.goto(URL_CARTA + '/p/' + idPlato('Smash Burger'))
  await expect(page.getByTestId('carta-ficha-agregar')).toBeDisabled()
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText('Consultar precio')
  q("UPDATE products SET catalog_visibility='visible' WHERE business_id=@BID AND name='Smash Burger'")
})

test('E10 si el negocio cobra solo en Bs: "Precios en $ · pagas en Bs a tasa BCV", sin Divisa ni Cashea', async ({ page }) => {
  setKey('catalog_divisa_methods', 'JSON_ARRAY()')
  await page.goto(URL_CARTA)
  const pagos = page.getByTestId('carta-franja-pago')
  await expect(pagos).toContainText('Precios en $ · pagas en Bs a tasa BCV')
  await expect(pagos).not.toContainText('Divisa')
  await expect(pagos).not.toContainText('Cashea')
  seed()
})

test('A6 / E7 "Agregar" suma al pedido; con tamaños abre la ficha; la barra muestra cantidad y total en $ y Bs', async ({ page }) => {
  await page.goto(URL_CARTA)
  await expect(page.getByTestId('carta-barra-pedido')).toHaveCount(0) // carrito vacío: la barra no se muestra
  await plato(page, 'Smash Burger').getByTestId('carta-plato-agregar').click()
  await expect.poll(() => cuenta(page)).toBe(1)
  await expect(page.getByTestId('carta-barra-total-usd')).toHaveText('$11.00')
  await expect(page.getByTestId('carta-barra-total-bs')).toContainText('Bs.')
  await plato(page, 'Punta Burger').getByTestId('carta-plato-agregar').click()
  await expect(page).toHaveURL(new RegExp('/p/' + idPlato('Punta Burger')))
  await expect(page.getByTestId('carta-ficha')).toBeVisible()
  await expect(page.getByTestId('carta-barra-pedido')).toHaveCount(0) // en la ficha solo va la barra "Agregar"
})

test('ficha: tamaños como botones (el menor por defecto, el total se actualiza), cantidad, nota y toques de 44 px', async ({ page }) => {
  await page.goto(URL_CARTA + '/p/' + idPlato('Punta Burger'))
  const tamanos = page.getByTestId('carta-tamano')
  await expect(tamanos).toHaveCount(2)
  await expect(tamanos.nth(0)).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText('$20.00')
  await tamanos.nth(1).click()
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText('$24.00')
  await page.getByRole('button', { name: 'Una más' }).click()
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText('$48.00')
  await page.getByTestId('carta-nota').fill('sin cebolla')
  for (const loc of [tamanos.nth(0), page.getByRole('button', { name: 'Una más' }), page.getByTestId('carta-ficha-agregar')]) {
    const box = await loc.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
  await page.getByTestId('carta-ficha-agregar').click()
  await expect(page.getByTestId('carta-agregado')).toBeVisible()
})

test('carrito y pedido: editar cantidad, quitar con confirmación, tamaño y nota visibles, WhatsApp completo y POST /order con origin catalog', async ({ page }) => {
  await page.goto(URL_CARTA + '/p/' + idPlato('Punta Burger'))
  await page.getByTestId('carta-tamano').nth(1).click()
  await page.getByRole('button', { name: 'Una más' }).click()
  await page.getByTestId('carta-nota').fill('sin cebolla')
  await page.getByTestId('carta-ficha-agregar').click()
  await expect(page.getByTestId('carta-agregado')).toBeVisible()
  await page.goto(URL_CARTA)
  await expect(page.getByTestId('carta-barra-cantidad')).toHaveText('2') // el carrito se restaura de localStorage tras hidratar
  await plato(page, 'Smash Burger').getByTestId('carta-plato-agregar').click()
  await page.getByTestId('carta-barra-pedido').click()

  const lineas = page.getByTestId('carta-linea')
  await expect(lineas).toHaveCount(2)
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('200 g')
  await expect(page.getByTestId('carta-linea-detalle')).toContainText('sin cebolla')
  await expect(page.getByTestId('carta-total-usd')).toHaveText('$59.00')
  await expect(page.getByTestId('carta-total-bs')).toContainText('Bs.')

  // quitar pide confirmación; cancelar conserva la línea
  await lineas.nth(1).getByTestId('carta-linea-quitar').click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(lineas).toHaveCount(2)
  await lineas.nth(1).getByTestId('carta-linea-quitar').click()
  await page.getByRole('button', { name: 'Quitar' }).last().click()
  await expect(lineas).toHaveCount(1)
  await expect(page.getByTestId('carta-total-usd')).toHaveText('$48.00')

  // datos obligatorios
  await page.getByTestId('carta-enviar').click()
  await expect(page.getByRole('alert').filter({ hasText: 'Escribe tu nombre' })).toBeVisible()
  await page.getByLabel('Tu nombre').fill('ZZB Prueba Carta')
  await page.getByLabel('Teléfono').fill('04141234567')
  await page.getByLabel('Cédula').fill('V12345678')
  await page.getByTestId('carta-modalidad-llevar').click()
  await page.getByTestId('carta-pago-bs').click()
  await page.getByTestId('carta-enviar').click()

  await expect(page.getByTestId('carta-confirmacion')).toBeVisible({ timeout: 20_000 })
  const mensaje = await page.getByTestId('carta-mensaje-wa').innerText()
  expect(mensaje).toContain('2x Punta Burger (200 g)')
  expect(mensaje).toContain('$48.00')
  expect(mensaje).toContain('Bs.')
  expect(mensaje).toContain('Modalidad: Para llevar')
  expect(mensaje).toContain('sin cebolla')
  await expect(page.getByTestId('carta-abrir-wa')).toHaveAttribute('href', /^https:\/\/wa\.me\/58/)
  expect(q("SELECT origin FROM orders WHERE business_id=@BID AND client_name='ZZB Prueba Carta'")).toBe('catalog')
  await expect(page.getByTestId('carta-barra-pedido')).toHaveCount(0)
})

test('E1 hero: sin ventas = Recomendados; con ventas pagadas de 30 días = favoritos; el plato del hero no se repite en De la casa', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(URL_CARTA)
  await expect(page.getByTestId('carta-hero')).toHaveAttribute('data-kind', 'dishes')
  await expect(page.getByTestId('carta-hero')).toContainText('Recomendados')
  await expect(page.getByTestId('carta-de-la-casa-card')).toHaveCount(3) // completa hasta 3 con platos que no están en el hero

  const pollo = idPlato('Pollo Crispy')
  q("INSERT INTO sales (business_id, cashier_id, status, rate_used, ticket_number, total_usd, total_bs, updated_at) VALUES (@BID, 1, 'paid', 900, 'ZZBCARTA-1', 50, 45000, NOW())")
  const venta = q("SELECT id FROM sales WHERE business_id=@BID AND ticket_number='ZZBCARTA-1'")
  q("INSERT INTO sale_items (sale_id, product_id, product_name, sale_mode, unit_label, quantity, price_per_unit_usd, subtotal_usd, subtotal_bs, rate_used) VALUES (" + venta + ", " + pollo + ", 'Pollo Crispy', 'unit', 'und', 5, 10, 50, 45000, 900)")
  await page.reload()
  await expect(page.getByTestId('carta-hero')).toContainText('Los favoritos de la casa')
  await expect(page.getByTestId('carta-hero-slide').first()).toContainText('Pollo Crispy')
  // ahora los destacados NO están en el hero: aparecen en De la casa (solo escritorio) y el de Pollo Crispy no se repite
  await expect(page.getByTestId('carta-de-la-casa')).toBeVisible()
  await expect(page.getByTestId('carta-de-la-casa-card')).toHaveCount(3)
  await expect(page.getByTestId('carta-de-la-casa')).not.toContainText('Pollo Crispy')
  await page.setViewportSize({ width: 375, height: 800 })
  await expect(page.getByTestId('carta-de-la-casa')).toBeHidden()
})

test('hero configurado: reutiliza el event_slider de landing_sections (2–8 slides) y alimenta og:image', async ({ page }) => {
  const cfg = JSON.stringify({ slides: [
    { title: 'Hoy: smash', subtitle: 'Doble carne', cta_text: 'Pedir', cta_link: URL_CARTA, image_url: '/uploads/zz-carta-hero.png' },
    { title: 'Brunch', subtitle: 'Hasta las 2', cta_text: 'Ver carta', cta_link: URL_CARTA, image_url: '/uploads/zz-carta-hero.png' },
  ] }).replace(/'/g, "''")
  q("INSERT INTO landing_sections (business_id, type, `order`, visible, config, updated_at) VALUES (@BID, 'event_slider', 1, 1, '" + cfg + "', NOW())")
  await page.goto(URL_CARTA)
  await expect(page.getByTestId('carta-hero')).toHaveAttribute('data-kind', 'slides')
  await expect(page.getByTestId('carta-hero-slide')).toHaveCount(2)
  await expect(page.getByTestId('carta-hero-slide').first()).toContainText('Hoy: smash')
  await expect(page.getByTestId('carta-hero-slide').first().getByRole('link', { name: 'Pedir' })).toBeVisible()
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/api\/og\/portada\/zzb-pruebas/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/)
  await expect(page).toHaveTitle(/Cafe con Bike/)
})

test('E2 hero: avanza solo, y NO avanza con prefers-reduced-motion', async ({ page, browser }) => {
  await page.goto(URL_CARTA)
  const hero = page.getByTestId('carta-hero')
  await expect(hero).toHaveAttribute('data-autoplay', 'on')
  await expect.poll(async () => hero.getAttribute('data-slide'), { timeout: 9000 }).toBe('1')

  const quieto = await contextoReducido(browser)
  await quieto.goto(URL_CARTA)
  await expect(quieto.getByTestId('carta-hero')).toHaveAttribute('data-autoplay', 'off')
  await quieto.waitForTimeout(6500)
  await expect(quieto.getByTestId('carta-hero')).toHaveAttribute('data-slide', '0')
  await quieto.context().close()
})

test('E3 / E4 / E11 / E13 fotos 4:5 y 16:9, tarjeta tipográfica sin foto, serif cargada, sin Plex ni fondo blanco, sin imágenes rotas', async ({ page }) => {
  q("DELETE FROM landing_sections WHERE business_id=@BID AND type='event_slider'")
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(URL_CARTA)
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach(i => { i.loading = 'eager' })
    await Promise.all(Array.from(document.images).map(i => (i.complete ? null : new Promise(res => { i.onload = res; i.onerror = res }))))
    await document.fonts.ready
  })
  const foto = await page.getByTestId('carta-plato-foto').first().boundingBox()
  expect(Math.abs((foto?.width ?? 1) / (foto?.height ?? 1) - 0.8)).toBeLessThan(0.02)
  const hero = await page.getByTestId('carta-hero').boundingBox()
  expect(Math.abs((hero?.width ?? 1) / (hero?.height ?? 1) - 16 / 9)).toBeLessThan(0.05)

  const sinFoto = plato(page, 'Keto Bowl').or(page.getByTestId('carta-plato').filter({ hasNot: page.getByTestId('carta-plato-foto') }).first())
  await expect(sinFoto.first().locator('img')).toHaveCount(0)

  await page.evaluate(() => document.fonts.ready)
  const fuentes = await page.evaluate(() => Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')))
  expect(fuentes.some(f => /fraunces/i.test(f))).toBe(true)
  expect(fuentes.some(f => /instrument/i.test(f))).toBe(true)
  expect(fuentes.some(f => /plex/i.test(f))).toBe(false)
  const fondo = await page.evaluate(() => getComputedStyle(document.querySelector('[data-carta-preset]') as Element).backgroundColor)
  expect(fondo).not.toBe('rgb(255, 255, 255)')

  const rotas = await page.evaluate(() => Array.from(document.images).filter(i => !(i.complete && i.naturalWidth > 0)).length)
  const sinAlt = await page.evaluate(() => Array.from(document.images).filter(i => i.getAttribute('alt') === null).length)
  expect(rotas).toBe(0)
  expect(sinAlt).toBe(0)
})

test('A7 / E10: ninguna página de la Carta contiene la palabra "Full"', async ({ page }) => {
  for (const url of [URL_CARTA, URL_CARTA + '/p/' + idPlato('Punta Burger'), URL_CARTA + '/p/' + idPlato('Smash Burger')]) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.body.innerText), url).not.toMatch(/\bFull\b/)
  }
})

for (const ancho of [375, 1280]) {
  test('A8 ' + ancho + ' px: portada, ficha y carrito sin scroll horizontal ni texto cortado', async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    for (const url of [URL_CARTA, URL_CARTA + '/p/' + idPlato('Punta Burger')]) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      expect(await sinScrollHorizontal(page), url + ' @' + ancho).toBe(true)
    }
    await page.goto(URL_CARTA)
    await plato(page, 'Smash Burger').getByTestId('carta-plato-agregar').click() // la barra de pedido aparece con el primer plato
    await page.evaluate(() => document.getElementById('cat-4')?.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(300)
    const barra = await page.getByTestId('carta-tabs').boundingBox()
    expect(barra?.y ?? 9999, 'barra fija @' + ancho).toBeLessThan(130)
    await page.getByTestId('carta-barra-pedido').click()
    await expect(page.getByTestId('carta-carrito')).toBeVisible()
    expect(await sinScrollHorizontal(page), 'carrito @' + ancho).toBe(true)
    const box = await page.getByTestId('carta-carrito').boundingBox()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(ancho + 1)
    const cortados = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main *, [data-testid="carrito"] *')).filter(el => {
        const cs = getComputedStyle(el)
        return el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.display !== 'inline' && cs.overflowX === 'hidden' && !el.matches('p, nav, nav *')
      }).map(el => (el as HTMLElement).className.slice(0, 40)))
    expect(cortados).toEqual([])
  })
}

test('E9 las dos direcciones (Brasa casual y Noche fine) y la paleta cerrada de acentos renderizan sin overflow a 375 y 1280', async ({ page }) => {
  for (const [preset, style, accent] of [['noche', 'fine', 'oro'], ['brasa', 'fine', 'vino'], ['noche', 'casual', 'azul']]) {
    setKey('carta_preset', "'" + preset + "'")
    setKey('carta_style', "'" + style + "'")
    setKey('carta_accent', "'" + accent + "'")
    for (const ancho of [375, 1280]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto(URL_CARTA)
      await page.waitForLoadState('networkidle')
      const root = page.locator('[data-carta-preset]')
      await expect(root).toHaveAttribute('data-carta-preset', preset)
      await expect(root).toHaveAttribute('data-carta-style', style)
      await expect(root).toHaveAttribute('data-carta-accent', accent)
      expect(await sinScrollHorizontal(page), preset + '/' + style + ' @' + ancho).toBe(true)
    }
  }
  // valores fuera de la paleta cerrada caen a los de por defecto
  setKey('carta_preset', "'inventado'")
  setKey('carta_accent', "'#ff00ff'")
  await page.goto(URL_CARTA)
  await expect(page.locator('[data-carta-preset]')).toHaveAttribute('data-carta-preset', 'brasa')
  expect(await page.locator('[data-carta-accent]').count()).toBe(0)
})
