import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import path from 'path'
import { expect, test, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Esqueleto del catálogo premium (un menú, enlaces por catalogHref, barras fijas al 92 % con blur) y guía Garmin V2
 * (…/guia/garmin?producto=<id>): selector con fotos, pasos con progreso guardado, extras, preguntas frecuentes, equipos satelitales.
 * Datos propios: negocio de pruebas ZZA (plantilla premium + settings.garmin_guide) con marca "Garmin" y productos de nombre real.
 * Capturas 375 en tests/__capturas__/zza-garmin-*.png (no se versionan).
 */
const { businessId: BID, slug: SLUG } = ownBusiness()
const HOME = `/catalogo-premium/${SLUG}`
const GUIA = `${HOME}/guia/garmin`
const FIXTURE = `/storage/tenants/${BID}/products/zza-garmin-fixture.webp`
const FIXTURE_FILE = path.join(process.cwd(), 'storage', 'tenants', String(BID), 'products', 'zza-garmin-fixture.webp')
const CAPTURAS = path.join(__dirname, '__capturas__')

const NOMBRES = {
  forerunner: 'Garmin Forerunner® 170 Music',
  fenix:      'Garmin fēnix® 9 - 47mm',
  instinct:   'Garmin Instinct® Crossover AMOLED',
  inreach:    'Garmin inReach® Mini 3 Plus',
  gpsmap:     'Garmin GPSMAP® H1i Plus',
  correa:     'Garmin Correa QuickFit® 22',
  plain:      'ZZA Garmin Camisa sin marca',
} as const
type Clave = keyof typeof NOMBRES

test.describe.configure({ mode: 'serial', timeout: 240_000 })

const ids = {} as Record<Clave, number>
let original = ''

test.beforeAll(() => {
  original = sql(`SELECT CONCAT_WS('|',catalog_template,COALESCE(phone,'')) FROM businesses WHERE id=${BID}`)
  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true })
  mkdirSync(CAPTURAS, { recursive: true })
  // Foto real de otro negocio (solo se LEE): hace de foto de los equipos; en producción cada Garmin trae la suya.
  const real = path.join(process.cwd(), 'storage', 'tenants', '87', 'products')
  const src = existsSync(real) ? readdirSync(real).find(f => f.endsWith('.webp') && !f.includes('_thumb')) : undefined
  if (src) copyFileSync(path.join(real, src), FIXTURE_FILE)

  sql(`UPDATE businesses SET catalog_template='premium', phone='584141234567',
       settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.garmin_guide',true) WHERE id=${BID}`)
  limpiar()
  sql(`INSERT INTO brands (business_id,name,search_term,visible) VALUES (${BID},'Garmin','garmin',1)`)
  const brand = Number(sql(`SELECT id FROM brands WHERE business_id=${BID} AND name='Garmin'`))
  const fila = (name: string, brandId: string) =>
    `INSERT INTO products (business_id,name,brand_id,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
     VALUES (${BID},'${name}',${brandId},'["${FIXTURE}"]',299,'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3))`
  ;(Object.keys(NOMBRES) as Clave[]).forEach(k => { sql(fila(NOMBRES[k], k === 'plain' ? 'NULL' : String(brand))) })
  ;(Object.keys(NOMBRES) as Clave[]).forEach(k => { ids[k] = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${NOMBRES[k]}'`)) })
})

function limpiar(): void {
  const nombres = Object.values(NOMBRES).map(n => `'${n}'`).join(',')
  sql(`DELETE FROM products WHERE business_id=${BID} AND name IN (${nombres})`)
  sql(`DELETE FROM brands WHERE business_id=${BID} AND name='Garmin'`)
}

test.afterAll(() => {
  const [template, phone] = original.split('|')
  sql(`UPDATE businesses SET catalog_template='${template}', phone=${phone ? `'${phone}'` : 'NULL'}, settings=JSON_REMOVE(settings,'$.garmin_guide') WHERE id=${BID}`)
  limpiar()
  rmSync(FIXTURE_FILE, { force: true })
})

/** En local no hay nginx que sirva /storage/…: se responde la foto de prueba desde disco, como en producción. */
const servirFotos = (page: Page): Promise<void> => page.route('**/storage/tenants/**', route => route.fulfill({ path: FIXTURE_FILE }))
const movil = (page: Page): Promise<void> => page.setViewportSize({ width: 375, height: 812 })
const abrir = async (page: Page, k: Clave): Promise<void> => { await servirFotos(page); await page.goto(`${GUIA}?producto=${ids[k]}`) }
const navLinks = (page: Page): Promise<string[]> =>
  page.locator('header nav[aria-label="Navegación principal"] a').evaluateAll(as => as.map(a => `${a.textContent}|${a.getAttribute('href')}`))

/** Avanza con "Listo" hasta el cierre; devuelve los títulos de los pasos recorridos. */
async function recorrer(page: Page): Promise<string[]> {
  const titulos: string[] = []
  const listo = page.getByRole('button', { name: 'Listo, siguiente paso' })
  for (let n = 0; n < 30 && (await listo.count()) > 0; n++) {
    titulos.push((await page.getByRole('heading', { level: 2 }).first().textContent()) ?? '')
    await listo.click()
  }
  return titulos
}

test('esqueleto: mismo menú en home, tienda, ficha y guía; logo e Inicio llevan al inicio del catálogo', async ({ page }) => {
  let first: string[] | null = null
  for (const r of [HOME, `${HOME}/productos`, `${HOME}/p/${ids.forerunner}`, GUIA]) {
    await page.goto(r)
    await expect(page.locator('header nav[aria-label="Navegación principal"]')).toBeVisible()
    const links = await navLinks(page)
    expect(links.map(l => l.split('|')[0])).toEqual(expect.arrayContaining(['Inicio', 'Tienda', 'Marcas']))
    if (first === null) first = links
    expect(links, `menú en ${r}`).toEqual(first)
    await page.getByRole('link', { name: /Ir al inicio de/ }).click()
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
    await page.goto(r)
    await page.locator('header nav[aria-label="Navegación principal"]').getByRole('link', { name: 'Inicio' }).click()
    await expect(page).toHaveURL(new RegExp(`${HOME}$`))
  }
})

test('punto 1: ?producto=<id> arranca directo con la foto, el nombre y "N pasos · ~15 min" (Forerunner, fēnix, Instinct)', async ({ page }) => {
  await movil(page)
  const casos: Array<[Clave, string]> = [['forerunner', 'Forerunner 170 Music'], ['fenix', 'fēnix 9'], ['instinct', 'Instinct Crossover AMOLED']]
  for (const [k, modelo] of casos) {
    await abrir(page, k)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOMBRES[k])
    await expect(page.getByText(/Guía de configuración · \d+ pasos · ~15 min/)).toBeVisible()
    await expect(page.getByRole('heading', { name: `Vamos a dejar tu ${modelo} listo` }), NOMBRES[k]).toBeVisible()
    expect(await page.getByAltText(NOMBRES[k]).first().getAttribute('src')).toContain('zza-garmin-fixture')
  }
  await abrir(page, 'forerunner')
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-paso1-375.png') })
})

test('punto 2: sin producto, el selector muestra los equipos Garmin con foto, nombre y precio en USD y Bs, por familia', async ({ page }) => {
  await movil(page)
  await servirFotos(page)
  await page.goto(GUIA)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Configura tu Garmin')
  const tabs = page.getByRole('group', { name: 'Familia' })
  for (const f of ['Forerunner', 'fēnix', 'Instinct', 'Satélite y navegación']) await expect(tabs.getByRole('button', { name: f })).toBeVisible()
  const tile = page.getByRole('button', { name: new RegExp(NOMBRES.forerunner.replace(/[®()]/g, '.')) })
  await expect(tile).toContainText('$299.00')
  await expect(tile).toContainText('Bs.')
  expect(await tile.getByRole('img').first().getAttribute('src')).toContain('zza-garmin-fixture')
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-selector-375.png') })
  await tabs.getByRole('button', { name: 'Satélite y navegación' }).click()
  await expect(page.getByRole('button', { name: /inReach/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /GPSMAP/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Otro modelo con pantalla táctil/ })).toBeVisible()
  await page.getByRole('button', { name: /inReach/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('inReach')
})

test('punto 3 y 4: pasos con progreso guardado, "Listo" avanza, problemas, contenido y diagrama junto a la foto', async ({ page }) => {
  await movil(page)
  await abrir(page, 'forerunner')
  await expect(page.getByText('Lo que necesitas antes de empezar')).toBeVisible()
  await expect(page.getByText('Consejos para Venezuela')).toBeVisible()
  await expect(page.getByText('Qué vas a hacer.')).toBeVisible()
  await expect(page.getByText('Por qué importa.')).toBeVisible()
  await expect(page.getByText('Error común.')).toBeVisible()
  await expect(page.getByText('Consejo OnBike.')).toBeVisible()
  // "Listo" marca y avanza; al recargar retoma en el siguiente paso.
  await page.getByRole('button', { name: 'Listo, siguiente paso' }).click()
  await expect(page.getByRole('heading', { name: 'Carga tu reloj' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Carga tu reloj' })).toBeVisible()
  // Problemas: 2-3 soluciones concretas.
  await page.getByText('¿Tienes un problema en este paso?').click()
  expect(await page.locator('details[open] p').count()).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: 'Listo, siguiente paso' }).click()
  await page.getByRole('button', { name: 'Listo, siguiente paso' }).click() // encendido → botones
  await expect(page.getByRole('heading', { name: 'Conoce tus botones' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Dibujo del reloj/ })).toBeVisible()
  await expect(page.getByAltText('Forerunner 170 Music')).toBeVisible() // foto junto al diagrama
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-botones-375.png') })
})

test('punto 5 y 6: sin enlaces a garmin.com, WhatsApp prellenado y cierre con resumen, compartir y accesorios', async ({ page }) => {
  await movil(page)
  await servirFotos(page)
  await page.goto(`${GUIA}?producto=${ids.forerunner}`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  const wa = page.getByRole('link', { name: 'Escríbenos por WhatsApp' }).first()
  await page.getByText('¿Tienes un problema en este paso?').click()
  const href = (await wa.getAttribute('href')) ?? ''
  expect(href).toContain('https://wa.me/584141234567?text=')
  expect(decodeURIComponent(href)).toContain('estoy configurando mi Forerunner 170 Music y voy en el paso 1: Vamos a dejar tu Forerunner 170 Music listo')

  // Ningún enlace a garmin.com en ningún paso.
  let externos = 0
  const listo = page.getByRole('button', { name: 'Listo, siguiente paso' })
  for (let n = 0; n < 30 && (await listo.count()) > 0; n++) {
    externos += await page.locator('a[href*="garmin.com"]').count()
    await listo.click()
  }
  expect(externos).toBe(0)
  await expect(page.getByRole('heading', { name: '¡Tu Forerunner 170 Music está listo!' })).toBeVisible()
  await expect(page.getByText(/\d+ de \d+ pasos completados/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compartir esta guía' })).toBeVisible()
  const accesorio = page.getByRole('link', { name: new RegExp(NOMBRES.correa.replace(/[®()]/g, '.')) })
  await expect(accesorio).toBeVisible()
  expect(await accesorio.getAttribute('href')).toBe(`${HOME}/p/${ids.correa}`)
  await expect(page.getByRole('link', { name: new RegExp(NOMBRES.fenix.replace(/[®()]/g, '.')) })).toHaveCount(0) // los relojes no son accesorios
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-final-375.png') })
})

test('addendum: extras (10 tarjetas), preguntas frecuentes (≥8) y ningún SVG mayor de 24 px salvo diagrama e ilustraciones', async ({ page }) => {
  await movil(page)
  await abrir(page, 'forerunner')
  const svgMayores = (): Promise<number[]> => page.locator('main svg:not([data-diagrama]):not([data-ilustracion])').evaluateAll(s => s.map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h > 24))
  expect(await svgMayores(), 'pestaña Pasos').toEqual([])
  await page.getByRole('tab', { name: 'Saca el máximo provecho' }).click()
  expect(await page.locator('details').count()).toBe(10)
  await page.getByText('Métricas de salud', { exact: false }).click()
  await expect(page.getByText('Body Battery:')).toBeVisible()
  expect(await svgMayores(), 'extras').toEqual([])
  await page.getByRole('tab', { name: 'Preguntas frecuentes' }).click()
  expect(await page.locator('details').count()).toBeGreaterThanOrEqual(8)
  // Pasos con íconos en texto (encendido) y en botones.
  await page.getByRole('tab', { name: 'Pasos' }).click()
  await page.getByRole('button', { name: 'Listo, siguiente paso' }).click()
  await page.getByRole('button', { name: 'Listo, siguiente paso' }).click()
  expect(await svgMayores(), 'paso de encendido').toEqual([])
})

test('addendum: equipos satelitales (inReach, GPSMAP) con aviso fijo, pasos propios y preguntas frecuentes', async ({ page }) => {
  await movil(page)
  for (const [k, primero] of [['inreach', 'Cárgalo por completo'], ['gpsmap', 'Cárgalo']] as const) {
    await abrir(page, k)
    await expect(page.getByRole('note')).toHaveText('Los mensajes, el SOS y el rastreo requieren un plan inReach activo.')
    await page.getByRole('button', { name: 'Listo, siguiente paso' }).click()
    await expect(page.getByRole('heading', { name: primero })).toBeVisible()
    await page.getByRole('tab', { name: 'Preguntas frecuentes' }).click()
    await expect(page.getByText('¿Necesito un plan?')).toBeVisible()
    for (const q of ['¿Funciona sin señal de teléfono?', '¿Por qué no sale el mensaje?', '¿Qué pasa si activo el SOS por error?', '¿Cuánto dura la batería?']) await expect(page.getByText(q)).toBeVisible()
  }
  await abrir(page, 'inreach')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  const titulos = await recorrer(page)
  expect(titulos.length).toBe(10)
  await expect(page.getByRole('heading', { name: '¡Tu inReach Mini 3 Plus está listo!' })).toBeVisible()
  await abrir(page, 'gpsmap')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  expect((await recorrer(page)).length).toBe(12)
})

test('punto 7: la ficha de un producto Garmin ofrece "Configura tu <modelo> paso a paso" con ?producto=<id>', async ({ page }) => {
  await movil(page)
  await servirFotos(page)
  await page.goto(`${HOME}/p/${ids.forerunner}`)
  const btn = page.getByRole('link', { name: 'Configura tu Forerunner 170 Music paso a paso' })
  await expect(btn).toBeVisible()
  expect(await btn.getAttribute('href')).toBe(`${GUIA}?producto=${ids.forerunner}`)
  expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-ficha-375.png') })
  await btn.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOMBRES.forerunner)
  await page.goto(`${HOME}/p/${ids.inreach}`)
  await expect(page.getByRole('link', { name: 'Configura tu inReach Mini 3 Plus paso a paso' })).toBeVisible()
  await page.goto(`${HOME}/p/${ids.plain}`)
  await expect(page.getByRole('link', { name: /Configura tu .* paso a paso/ })).toHaveCount(0)
})

/** Alfa del color computado ("color(srgb 1 1 1 / 0.92)" o "rgba(…, 0.92)"); 1 si es opaco. */
const alfa = (css: string): number => {
  const m = css.match(/\/\s*([\d.]+)\s*\)/) ?? css.match(/rgba\([^)]*,\s*([\d.]+)\)/)
  return m ? Number(m[1]) : 1
}

test('punto 8: barras fijas premium al 92 % con blur(12px) (encabezado, menú inferior y barra de la guía)', async ({ page }) => {
  await movil(page)
  await servirFotos(page)
  const estilo = (loc: ReturnType<Page['locator']>) => loc.evaluate(el => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, filter: s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter') }
  })
  await page.goto(`${HOME}/p/${ids.forerunner}`)
  for (const [nombre, loc] of [['encabezado', page.locator('header').first()], ['menú inferior', page.locator('nav[aria-label="Navegación móvil"]')]] as const) {
    const s = await estilo(loc)
    expect(alfa(s.bg), `${nombre}: ${s.bg}`).toBeCloseTo(0.92, 2)
    expect(s.filter, nombre).toContain('blur(12px)')
  }
  await page.evaluate(() => window.scrollTo(0, 420))
  await page.screenshot({ path: path.join(CAPTURAS, 'zza-garmin-barra-375.png') })
  await abrir(page, 'forerunner')
  const g = await estilo(page.getByRole('button', { name: 'Siguiente', exact: true }).locator('xpath=../..'))
  expect(alfa(g.bg), `barra de la guía: ${g.bg}`).toBeCloseTo(0.92, 2)
  expect(g.filter).toContain('blur(12px)')
})

test('activable por negocio: con garmin_guide apagado no hay guía (404) ni botón en la ficha', async ({ page }) => {
  sql(`UPDATE businesses SET settings=JSON_SET(settings,'$.garmin_guide',false) WHERE id=${BID}`)
  const res = await page.goto(GUIA)
  expect(res?.status()).toBe(404)
  await page.goto(`${HOME}/p/${ids.forerunner}`)
  await expect(page.getByRole('link', { name: /Configura tu .* paso a paso/ })).toHaveCount(0)
})
