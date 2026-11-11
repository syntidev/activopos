import { test, expect, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Paridad con ordena.menu (negocio propio 217, prefijo ZZB): plato servicio nunca "Agotado" (con y sin tamaños), encabezado con portada y
 * logo en círculo superpuesto, hero de favoritos DEBAJO, barra de categorías (scroll marca y centra el chip; tocar lleva a la sección)
 * y tarjeta completa tocable.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 812 } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))
const idOf = (name: string): number => Number(q("SELECT id FROM products WHERE business_id=@BID AND name='" + name + "'"))
const SIN_TAMANOS = 'Cheez Burger Clásica Americana'
const CON_TAMANOS = 'Punta Burger'

test.beforeAll(() => {
  bid = ensureOwnBusiness()
  // Platos importados: tipo servicio, sin inventario (ni en el producto ni en sus tamaños).
  const ids = [idOf(SIN_TAMANOS), idOf(CON_TAMANOS)].join(',')
  q("UPDATE products SET sale_mode='service', sold_out_date=NULL WHERE id IN (" + ids + ')')
  q('DELETE FROM inventory_entries WHERE business_id=@BID AND product_id IN (' + ids + ')')
  q('UPDATE product_variants SET stock=0 WHERE product_id IN (' + ids + ')')
})
test.afterAll(() => {
  q("UPDATE products SET sale_mode='unit', sold_out_date=NULL WHERE business_id=@BID AND name IN ('" + SIN_TAMANOS + "','" + CON_TAMANOS + "')")
  ensureOwnBusiness() // repone existencias del seed
})

const ficha = (page: Page, id: number) => page.goto('/catalogo-carta/' + OWN_SLUG + '/p/' + id)

test('servicio sin tamaños: no sale Agotado y se agrega al carrito', async ({ page }) => {
  await ficha(page, idOf(SIN_TAMANOS))
  await expect(page.getByTestId('carta-agotado-hoy')).toHaveCount(0)
  const agregar = page.getByTestId('carta-ficha-agregar')
  await expect(agregar).toBeEnabled()
  await expect(agregar).not.toContainText('Agotado')
  await agregar.click()
  await expect(page.getByTestId('carta-agregado')).toBeVisible()
})

test('servicio con tamaños (stock 0 en cada tamaño): tamaños elegibles y se agrega', async ({ page }) => {
  await ficha(page, idOf(CON_TAMANOS))
  const tamanos = page.getByTestId('carta-tamano')
  expect(await tamanos.count()).toBeGreaterThan(0)
  await expect(tamanos.first()).toBeEnabled()
  await tamanos.first().click()
  await page.getByTestId('carta-ficha-agregar').click()
  await expect(page.getByTestId('carta-agregado')).toBeVisible()
})

test('servicio: POST /order lo acepta (sin "Stock insuficiente") y sold_out_date de hoy sí lo agota', async ({ page, request }) => {
  const pedir = (n: number) => request.post('/api/catalog/' + OWN_SLUG + '/order', {
    data: { items: [{ product_id: idOf(SIN_TAMANOS), qty: 1 }], customer_name: 'ZZB Servicio ' + n, customer_phone: '0414777' + String(1000 + n), customer_reference: 'Prueba', payment_method: 'Zelle', payment_kind: 'bs', delivery_type: 'pickup' },
  })
  expect((await pedir(1)).status()).toBe(201)
  q('UPDATE products SET sold_out_date=CURDATE() WHERE id=' + idOf(SIN_TAMANOS))
  expect((await pedir(2)).status()).toBe(409)
  await ficha(page, idOf(SIN_TAMANOS))
  await expect(page.getByTestId('carta-agotado-hoy')).toBeVisible()
  q('UPDATE products SET sold_out_date=NULL WHERE id=' + idOf(SIN_TAMANOS))
  q("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB Servicio %')")
  q("DELETE FROM orders WHERE business_id=@BID AND client_name LIKE 'ZZB Servicio %'")
  q("DELETE FROM clients WHERE business_id=@BID AND name LIKE 'ZZB Servicio %'")
})

test('encabezado: portada a lo ancho, logo en círculo superpuesto, estado y dirección; el hero va DEBAJO', async ({ page }) => {
  q("UPDATE businesses SET address='Centro Comercial La Redoma' WHERE id=@BID")
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const portada = (await page.getByTestId('carta-portada-negocio').boundingBox())!
  const logo = (await page.getByTestId('carta-logo').boundingBox())!
  expect(Math.round(portada.width)).toBe(375)
  expect(portada.height).toBeGreaterThanOrEqual(185)
  expect(Math.abs(logo.width - 96)).toBeLessThanOrEqual(1)
  expect(logo.y, 'el logo nace dentro de la portada').toBeLessThan(portada.y + portada.height)
  expect(logo.y + logo.height, 'y se superpone al borde inferior de la portada').toBeGreaterThan(portada.y + portada.height)
  expect(await page.getByTestId('carta-logo').evaluate(el => getComputedStyle(el).borderRadius)).toMatch(/50%|48px/)
  await expect(page.getByTestId('carta-estado')).toContainText('Abierto')
  await expect(page.getByTestId('carta-direccion-negocio')).toContainText('Centro Comercial La Redoma')
  const enc = (await page.getByTestId('carta-encabezado').boundingBox())!
  const hero = (await page.getByTestId('carta-hero').boundingBox())!
  expect(hero.y, 'el hero de favoritos va debajo del encabezado').toBeGreaterThanOrEqual(enc.y + enc.height - 2)
  q('UPDATE businesses SET address=NULL WHERE id=@BID')
})

test('barra de categorías: el scroll marca y CENTRA el chip; tocar un chip baja a su sección bajo la barra fija', async ({ page }) => {
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const tabs = page.locator('[data-testid^="carta-tab-"]')
  expect(await tabs.count()).toBeGreaterThan(6)
  // Scroll a una sección lejana: su chip queda marcado y centrado en la barra.
  await page.evaluate(() => document.getElementById('cat-6')?.scrollIntoView({ block: 'start' }))
  await expect.poll(async () => tabs.nth(6).getAttribute('aria-selected'), { timeout: 8000 }).toBe('true')
  await expect.poll(async () => {
    return page.evaluate(() => {
      const nav = document.querySelector('[data-testid="carta-tabs"]')!.getBoundingClientRect()
      const chip = document.querySelectorAll('[data-testid^="carta-tab-"]')[6].getBoundingClientRect()
      return Math.abs((chip.left + chip.width / 2) - (nav.left + nav.width / 2))
    })
  }, { timeout: 8000 }).toBeLessThan(40)
  // Tocar un chip: la sección queda justo debajo de la barra fija.
  await page.evaluate(() => window.scrollTo(0, 0))
  await tabs.nth(3).click()
  await expect.poll(async () => page.evaluate(() => {
    const bar = document.querySelector('[data-testid="carta-barra-categorias"]')!.getBoundingClientRect().bottom
    return Math.abs(document.getElementById('cat-3')!.getBoundingClientRect().top - (bar + 8))
  }), { timeout: 8000 }).toBeLessThanOrEqual(8)
  // Íconos de buscar y de menú en la barra; el menú lista las categorías y lleva a la sección.
  await expect(page.getByTestId('carta-buscar-btn')).toBeVisible()
  await page.getByTestId('carta-menu-btn').click()
  await expect(page.getByTestId('carta-menu-categorias')).toBeVisible()
  await page.getByTestId('carta-menu-categorias').getByRole('menuitem').nth(1).click()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 8000 })
})

test('tarjeta completa tocable: tocar cualquier parte (no solo el título) abre la ficha; "Agregar" sigue aparte', async ({ page }) => {
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const card = page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' }).first()
  await card.scrollIntoViewIfNeeded()
  await card.click({ position: { x: 6, y: 6 } }) // esquina de la tarjeta, lejos del título
  await expect(page).toHaveURL(new RegExp('/p/' + idOf('Smash Burger')))
  await page.goBack()
  await page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' }).first().getByTestId('carta-plato-agregar').click()
  await expect(page).not.toHaveURL(/\/p\//) // "Agregar" no navega: suma al pedido
  await expect(page.getByTestId('carta-barra-pedido')).toBeVisible()
  await page.evaluate(() => window.localStorage.clear())
})

test('fotos de /storage: el HTML trae <img src="/storage/...">, nunca /_next/image (Nginx sirve /storage, no Next)', async ({ request }) => {
  const id = idOf('Smash Burger')
  q("UPDATE products SET images='[\"/storage/tenants/217/products/zzb-prueba.webp\"]' WHERE id=" + id)
  q("UPDATE businesses SET logo_path='/storage/tenants/217/logo/zzb-logo.webp', catalog_cover_path='/storage/tenants/217/catalog_cover/zzb-portada.webp' WHERE id=@BID")
  try {
    for (const url of ['/catalogo-carta/' + OWN_SLUG, '/catalogo-carta/' + OWN_SLUG + '/p/' + id]) {
      const html = await (await request.get(url)).text()
      expect(html, url).toContain('src="/storage/tenants/217/products/zzb-prueba.webp"')
      expect(html, url).not.toContain('/_next/image')
    }
    const lista = await (await request.get('/catalogo-carta/' + OWN_SLUG)).text()
    expect(lista).toContain('src="/storage/tenants/217/logo/zzb-logo.webp"')
    expect(lista).toContain('src="/storage/tenants/217/catalog_cover/zzb-portada.webp"')
  } finally {
    q('UPDATE products SET images=NULL WHERE id=' + id)
    q('UPDATE businesses SET logo_path=NULL, catalog_cover_path=NULL WHERE id=@BID')
  }
})

test('identidad: encabezado compacto al bajar (aparece, queda sobre la barra de categorías y desaparece al volver)', async ({ page }) => {
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const compacta = page.getByTestId('carta-barra-compacta')
  await expect(compacta).toHaveAttribute('data-visible', 'false')
  await page.evaluate(() => window.scrollTo(0, 900))
  await expect(compacta).toHaveAttribute('data-visible', 'true')
  const alto = (await compacta.boundingBox())!.height
  expect(alto).toBeGreaterThanOrEqual(40)
  await expect.poll(async () => Math.round((await page.getByTestId('carta-barra-categorias').boundingBox())!.y)).toBe(Math.round(alto))
  const logo = (await compacta.locator('span').first().boundingBox())!
  expect(logo.width).toBeGreaterThanOrEqual(28)
  expect(logo.width).toBeLessThanOrEqual(32)
  await expect(compacta).toContainText('Abierto')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(compacta).toHaveAttribute('data-visible', 'false')
})

test('identidad: crédito "Desarrollado por ActivoPOS.com" en Carta, genérico y premium, con utm del slug', async ({ request }) => {
  const esperado = 'https://activopos.com/?utm_source=' + OWN_SLUG + '&amp;utm_medium=catalogo'
  try {
    for (const [plantilla, ruta] of [['carta', '/catalogo-carta/'], ['generic', '/catalogo/'], ['premium', '/catalogo-premium/']] as const) {
      q("UPDATE businesses SET catalog_template='" + plantilla + "' WHERE id=@BID")
      const html = await (await request.get(ruta + OWN_SLUG)).text()
      expect(html, plantilla).toContain('Desarrollado por')
      expect(html, plantilla).toContain(esperado)
      expect(html, plantilla).toMatch(/rel="noopener"/)
    }
  } finally {
    q("UPDATE businesses SET catalog_template='carta' WHERE id=@BID")
  }
})

test('identidad: tarjeta sin foto compacta (sin letra gigante, acento en el borde) y ficha sin foto con franja del preset', async ({ page }) => {
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const tarjeta = page.locator('[data-testid="carta-plato"][data-sin-foto="true"]').first()
  expect(await tarjeta.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('1px') // sin el borde izquierdo de acento
  const vacia = tarjeta.getByTestId('carta-plato-foto-vacia') // recuadro con ícono, del mismo tamaño que una foto (96 px de ancho en móvil)
  await expect(vacia).toBeVisible()
  expect((await vacia.boundingBox())!.width).toBe(96)
  expect(await vacia.locator('svg').count()).toBe(1)
  await ficha(page, idOf('Smash Burger'))
  const franja = page.getByTestId('carta-ficha-franja')
  await expect(franja).toContainText('Smash Burger')
  expect((await franja.boundingBox())!.height).toBeLessThanOrEqual(90)
  await expect(page.locator('h1')).toHaveCount(1)
})

test('identidad: estado sin carta_hours usa el texto de catalog_hours; sin ninguno, no muestra estado', async ({ page }) => {
  q("UPDATE businesses SET settings=JSON_REMOVE(settings,'$.carta_hours'), catalog_hours='Lunes a domingo de 7am a 10pm' WHERE id=@BID")
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  await expect(page.getByTestId('carta-estado')).toContainText('Lunes a domingo de 7am a 10pm')
  await expect(page.getByTestId('carta-estado')).not.toContainText('Cerrado')
  q('UPDATE businesses SET catalog_hours=NULL WHERE id=@BID')
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  await expect(page.getByTestId('carta-estado')).toHaveCount(0)
  ensureOwnBusiness() // repone horario y texto del seed
})
