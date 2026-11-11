import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import path from 'path'
import { expect, test, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Esqueleto del catálogo premium (un solo encabezado/menú/pie, enlaces por catalogHref) y guía Garmin (…/guia/garmin).
 * Datos propios: negocio de pruebas ZZA (plantilla premium + settings.garmin_guide) con marca "Garmin" y productos "ZZA Garmin …".
 * Capturas 375 en tests/__capturas__/zza-garmin-*.png (no se versionan).
 */
const { businessId: BID, slug: SLUG } = ownBusiness()
const HOME = `/catalogo-premium/${SLUG}`
const FIXTURE = `/storage/tenants/${BID}/products/zza-garmin-fixture.webp`
const FIXTURE_FILE = path.join(process.cwd(), 'storage', 'tenants', String(BID), 'products', 'zza-garmin-fixture.webp')
const CAPTURAS = path.join(__dirname, '__capturas__')
const MODELO = 'ZZA Garmin Forerunner 965'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

let garminId = 0
let plainId = 0
let original = ''

test.beforeAll(() => {
  original = sql(`SELECT CONCAT_WS('|',catalog_template,COALESCE(phone,'')) FROM businesses WHERE id=${BID}`)
  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true })
  mkdirSync(CAPTURAS, { recursive: true })
  // Foto real de otro negocio (solo se LEE): hace de foto del reloj; en producción cada Garmin trae la suya.
  const real = path.join(process.cwd(), 'storage', 'tenants', '87', 'products')
  const src = existsSync(real) ? readdirSync(real).find(f => f.endsWith('.webp') && !f.includes('_thumb')) : undefined
  if (src) copyFileSync(path.join(real, src), FIXTURE_FILE)

  sql(`UPDATE businesses SET catalog_template='premium', phone='584141234567',
       settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.garmin_guide',true) WHERE id=${BID}`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Garmin%'`)
  sql(`DELETE FROM brands WHERE business_id=${BID} AND name='Garmin'`)
  sql(`INSERT INTO brands (business_id,name,search_term,visible) VALUES (${BID},'Garmin','garmin',1)`)
  const brand = Number(sql(`SELECT id FROM brands WHERE business_id=${BID} AND name='Garmin'`))
  const row = (name: string, brandId: string, images: string) =>
    `INSERT INTO products (business_id,name,brand_id,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
     VALUES (${BID},'${name}',${brandId},'${images}',499,'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3))`
  sql(row(MODELO, String(brand), `["${FIXTURE}"]`))
  sql(row('ZZA Garmin Camisa sin marca', 'NULL', '[]'))
  garminId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${MODELO}'`))
  plainId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='ZZA Garmin Camisa sin marca'`))
})

test.afterAll(() => {
  const [template, phone] = original.split('|')
  sql(`UPDATE businesses SET catalog_template='${template}', phone=${phone ? `'${phone}'` : 'NULL'}, settings=JSON_REMOVE(settings,'$.garmin_guide') WHERE id=${BID}`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Garmin%'`)
  sql(`DELETE FROM brands WHERE business_id=${BID} AND name='Garmin'`)
  rmSync(FIXTURE_FILE, { force: true })
})

/** En local no hay nginx que sirva /storage/…: se responde la foto de prueba desde disco, como en producción. */
const servirFotos = (page: Page): Promise<void> => page.route('**/storage/tenants/**', route => route.fulfill({ path: FIXTURE_FILE }))

const navLinks = (page: Page): Promise<string[]> =>
  page.locator('header nav[aria-label="Navegación principal"] a').evaluateAll(as => as.map(a => `${a.textContent}|${a.getAttribute('href')}`))

test('punto 2: mismo menú en home, tienda, ficha y guía; logo e Inicio llevan al inicio del catálogo', async ({ page }) => {
  const routes = ['', '/productos', `/p/${garminId}`, '/guia/garmin']
  let first: string[] | null = null
  for (const r of routes) {
    await page.goto(HOME + r)
    await expect(page.locator('header nav[aria-label="Navegación principal"]')).toBeVisible()
    const links = await navLinks(page)
    expect(links.map(l => l.split('|')[0])).toEqual(expect.arrayContaining(['Inicio', 'Tienda', 'Marcas']))
    if (first === null) first = links
    // Mismo menú en todas las rutas (el "Marcas" de la home ancla a #marcas: mismo href en todas).
    expect(links, `menú en ${r || 'home'}`).toEqual(first)

    await page.getByRole('link', { name: /Ir al inicio de/ }).click()
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
    await page.goto(HOME + r)
    await page.locator('header nav[aria-label="Navegación principal"]').getByRole('link', { name: 'Inicio' }).click()
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
  }
})

test('punto 2 (móvil): la barra inferior de la ficha lleva a Inicio y a Tienda', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HOME}/p/${garminId}`)
  const tabs = page.locator('nav[aria-label="Navegación móvil"]')
  await expect(tabs).toBeVisible()
  await tabs.getByRole('button', { name: 'Tienda' }).click()
  await expect(page).toHaveURL(new RegExp(`${HOME}/productos$`))
  await page.goto(`${HOME}/p/${garminId}`)
  await tabs.getByRole('button', { name: 'Inicio' }).click()
  await expect(page).toHaveURL(new RegExp(`${HOME}$`))
})

test('puntos 3, 4 y 7: guía con ?modelo=, foto del producto Garmin, pestañas, FAQ, WhatsApp y 375 sin desborde', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await servirFotos(page)
  await page.goto(`${HOME}/guia/garmin?modelo=${encodeURIComponent(MODELO)}`)

  const row = page.getByRole('button', { name: /Forerunner 965/ })
  await expect(row).toHaveAttribute('aria-pressed', 'true') // preseleccionado por ?modelo=
  await page.getByRole('button', { name: 'Crear mi guía' }).click()

  // Paso 1: foto del producto Garmin del negocio (primera foto), con compara-con-la-caja.
  const photo = page.getByAltText('Forerunner 965')
  await expect(photo).toBeVisible()
  expect(await photo.getAttribute('src')).toContain('zza-garmin-fixture')
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-guia-375.png') })

  const root = page.locator('[data-theme="light"]').first()
  const next = page.getByRole('button', { name: 'Siguiente' })
  expect((await next.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

  let sawDiagram = false
  let sawTabs = false
  for (let n = 0; n < 30 && (await next.count()) > 0; n++) {
    if (await page.getByRole('img', { name: /Dibujo del reloj/ }).count()) sawDiagram = true
    if (await page.getByRole('button', { name: 'Android' }).count()) {
      sawTabs = true
      await page.getByRole('button', { name: 'Android' }).click()
      await expect(page.getByText('Google Play Store')).toBeVisible()
      await page.getByRole('button', { name: 'iPhone' }).click()
      await expect(page.getByText('App Store')).toBeVisible()
    }
    // Sin scroll horizontal en ningún paso.
    expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth), `desborde en el paso ${n + 1}`).toBe(true)
    await next.click()
  }
  expect(sawDiagram).toBe(true)
  expect(sawTabs).toBe(true)

  // Último paso: preguntas frecuentes, WhatsApp del negocio, compartir y cambiar de reloj.
  await expect(page.getByRole('heading', { name: 'Cuidado y ayuda' })).toBeVisible()
  expect(await page.locator('details').count()).toBeGreaterThanOrEqual(4)
  await expect(page.getByRole('link', { name: 'Escribirnos por WhatsApp' })).toHaveAttribute('href', 'https://wa.me/584141234567')
  await expect(page.getByRole('button', { name: 'Compartir esta guía' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Elegir otro reloj' })).toBeVisible()

  // La barra fija no tapa el final: el contenedor deja de relleno al menos el alto de la barra.
  const pad = await page.locator('main').evaluate(m => parseFloat(getComputedStyle(m.parentElement as HTMLElement).paddingBottom))
  const barH = await page.getByRole('button', { name: 'Anterior' }).evaluate(b => (b.parentElement?.parentElement as HTMLElement).getBoundingClientRect().height)
  expect(pad).toBeGreaterThanOrEqual(barH)
})

test('punto 5: la ficha de un producto Garmin ofrece la guía con ?modelo=; la de otra marca no', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await servirFotos(page)
  await page.goto(`${HOME}/p/${garminId}`)
  const btn = page.getByRole('link', { name: 'Configura tu Garmin paso a paso' })
  await expect(btn).toBeVisible()
  expect(await btn.getAttribute('href')).toBe(`${HOME}/guia/garmin?modelo=${encodeURIComponent(MODELO)}`)
  expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' })) // centrado: la barra inferior flotante no lo tapa
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-ficha-375.png') })
  await btn.click()
  await expect(page.getByRole('button', { name: /Forerunner 965/ })).toHaveAttribute('aria-pressed', 'true')

  await page.goto(`${HOME}/p/${plainId}`)
  await expect(page.getByRole('link', { name: 'Configura tu Garmin paso a paso' })).toHaveCount(0)
})

test('activable por negocio: con garmin_guide apagado no hay guía (404) ni botón en la ficha', async ({ page }) => {
  sql(`UPDATE businesses SET settings=JSON_SET(settings,'$.garmin_guide',false) WHERE id=${BID}`)
  const res = await page.goto(`${HOME}/guia/garmin`)
  expect(res?.status()).toBe(404)
  await page.goto(`${HOME}/p/${garminId}`)
  await expect(page.getByRole('link', { name: 'Configura tu Garmin paso a paso' })).toHaveCount(0)
})
