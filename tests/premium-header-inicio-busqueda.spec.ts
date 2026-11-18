import { test, expect, type Page } from '@playwright/test'
import { sql } from './alta-helpers'

/**
 * Catálogo premium (OnBike local, SOLO lectura): header sólido fuera de la portada, INICIO en un clic (activopos.com y dominio propio)
 * y "la última acción manda" entre buscador y filtros, con la URL reflejando el estado y el botón atrás funcionando.
 * Dominio propio simulado con x-forwarded-host (el servidor de dev lo acepta); requiere CUSTOM_DOMAINS="onbikemargarita.com=onbike:premium".
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const NATIVO = '/catalogo-premium/onbike'
const CON_HERO = Number(sql("SELECT COUNT(*) FROM businesses WHERE id=87 AND catalog_cover_path IS NOT NULL AND catalog_cover_path <> ''")) > 0 // la portada solo es transparente si tiene hero debajo
const PROD = Number(sql("SELECT id FROM products WHERE business_id=87 AND active=1 AND show_in_catalog=1 ORDER BY id LIMIT 1"))

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })
test.describe.configure({ timeout: 90_000 })

const header = (page: Page) => page.locator('header[class*="stickyHeader"]').first()
const alfa = async (page: Page): Promise<number> => header(page).evaluate(el => {
  const c = getComputedStyle(el).backgroundColor // rgb(...), rgba(...) o color(srgb r g b / a)
  const barra = /\/\s*([\d.]+)\s*\)/.exec(c)
  if (barra) return parseFloat(barra[1])
  const m = /rgba?\(([^)]+)\)/.exec(c)
  if (!m) return 1
  const p = m[1].split(',').map(x => parseFloat(x))
  return p.length > 3 ? p[3] : 1
})
const scrollear = (page: Page, y: number) => page.evaluate(top => {
  const h = document.querySelector('header[class*="stickyHeader"]') as HTMLElement
  window.scrollTo(0, top)
  for (let el = h.parentElement; el; el = el.parentElement) el.scrollTo(0, top)
}, y)

test('bug 1: el header es transparente solo sobre el hero de la portada; el resto de rutas nace sólido', async ({ page }) => {
  await page.goto(NATIVO)
  await expect(header(page)).toBeVisible()
  if (CON_HERO) {
    expect(await alfa(page), 'portada con hero: transparente arriba').toBeLessThan(0.1)
    await scrollear(page, 500)
    await expect.poll(() => alfa(page)).toBeGreaterThan(0.7)
  } else {
    expect(await alfa(page), 'portada sin hero: sólido desde el primer píxel').toBeGreaterThan(0.7)
  }
  // /guia/garmin y /200k: 404 en OnBike local (sin datos); usan el mismo hook useHeaderSolid.
  for (const ruta of [NATIVO + '/productos', NATIVO + '/p/' + PROD]) {
    await page.goto(ruta)
    await expect(header(page), ruta).toBeVisible()
    expect(await alfa(page), ruta + ': sólido desde el primer píxel').toBeGreaterThan(0.7)
  }
})

test('bug 2: INICIO lleva a la portada en un clic desde /tienda y /p, y si ya estás en la portada sube al tope', async ({ page }) => {
  for (const origen of [NATIVO + '/productos', NATIVO + '/p/' + PROD]) {
    await page.goto(origen)
    await header(page).getByRole('link', { name: 'Inicio', exact: true }).click()
    await expect(page, origen).toHaveURL(new RegExp(NATIVO + '/?$'))
  }
  await page.goto(NATIVO)
  await scrollear(page, 900)
  await header(page).getByRole('link', { name: 'Inicio', exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const h = document.querySelector('header[class*="stickyHeader"]') as HTMLElement
    let max = window.scrollY
    for (let el = h.parentElement; el; el = el.parentElement) max = Math.max(max, el.scrollTop)
    return max
  }), { timeout: 8000 }).toBeLessThan(5)
})

test('bug 2 (dominio propio): INICIO desde /tienda y /p/:id lleva a "/"', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-host': 'onbikemargarita.com' } })
  const page = await ctx.newPage()
  for (const origen of ['/tienda', '/p/' + PROD]) {
    await page.goto(origen)
    await header(page).getByRole('link', { name: 'Inicio', exact: true }).click()
    await expect(page, origen).toHaveURL(/\/$/)
  }
  await ctx.close()
})

test('bug 3: la última acción manda (buscador ↔ filtros), la URL lo refleja y atrás restaura', async ({ page }) => {
  await page.goto(NATIVO + '/productos')
  const buscador = page.getByPlaceholder('Buscar productos...').first()
  const categoria = page.locator('[class*="catalogSidebarItem"]:visible').nth(1) // 0 = "Todos"; 1 = primera categoría
  const nombre = (await categoria.innerText()).split(String.fromCharCode(10))[0].trim()
  expect(nombre).not.toBe('')

  await categoria.click()
  await expect(page).toHaveURL(/categoria=/)
  await buscador.fill('camisa')
  await expect(page, 'escribir limpia el filtro de categoría').not.toHaveURL(/categoria=/)
  await expect(page).toHaveURL(/buscar=camisa/)

  await page.locator('[class*="catalogSidebarItem"]:visible').nth(1).click()
  await expect(buscador, 'tocar una categoría limpia el texto').toHaveValue('')
  await expect(page).toHaveURL(/categoria=/)
  await expect(page).not.toHaveURL(/buscar=/)

  await page.goBack() // deshace el filtro: vuelve al texto buscado
  await expect(page).toHaveURL(/buscar=camisa/)
  await expect(buscador).toHaveValue('camisa')
})
