import { test, expect, type Page } from '@playwright/test'
import { BASE, SLUG, PLATOS, CATEGORIAS, sembrarCarta, limpiarCarta, urlCarta, slugCategoria, platosQueCoinciden } from './carta-helpers'

/**
 * Carta · tabs fijas con scroll-spy, búsqueda híbrida (plato o ingrediente) y plato sin foto.
 * SPEC §4.2-4.3, §12.2, §12.5, A3, A4, E3, E5, E6. Contrato de selectores: .doc/carta/TESTIDS.md.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 60_000 })

test.beforeAll(() => { sembrarCarta({ slug: SLUG }) })
test.afterAll(() => { limpiarCarta(SLUG) })

const visibles = (page: Page) => page.getByTestId('carta-plato').filter({ visible: true })

test('A3: hay una tab por categoría del xlsx, con conteo, en el orden del menú', async ({ page }) => {
  await page.goto(urlCarta())
  const tabs = page.getByTestId('carta-tabs')
  await expect(tabs).toBeVisible()
  for (const cat of CATEGORIAS) {
    const n = PLATOS.filter(p => p.categoria === cat).length
    await expect(tabs.getByTestId(`carta-tab-${slugCategoria(cat)}`)).toContainText(String(n))
  }
  const orden = await tabs.locator('[data-testid^="carta-tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(orden).toEqual(CATEGORIAS.map(c => `carta-tab-${slugCategoria(c)}`))
})

test('A3: tocar una tab lleva a su sección y la deja activa', async ({ page }) => {
  await page.goto(urlCarta())
  const destino = slugCategoria('Ensaladas')
  await page.getByTestId(`carta-tab-${destino}`).click()
  await expect(page.getByTestId(`carta-seccion-${destino}`)).toBeInViewport()
  await expect(page.getByTestId(`carta-tab-${destino}`)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('carta-tabs').locator('[aria-selected="true"]')).toHaveCount(1)
})

test('E5: el scroll-spy cambia la tab activa al desplazarse (sin tocar las tabs)', async ({ page }) => {
  await page.goto(urlCarta())
  for (const cat of ['Pollo', 'Acompañantes', 'Banquetes y eventos']) {
    const s = slugCategoria(cat)
    await page.getByTestId(`carta-seccion-${s}`).evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await expect(page.getByTestId(`carta-tab-${s}`)).toHaveAttribute('aria-selected', 'true')
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.getByTestId(`carta-tab-${slugCategoria(CATEGORIAS[0])}`)).toHaveAttribute('aria-selected', 'true')
})

test('A3: el carril de tabs scrollea por dentro, no la página (375 px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(urlCarta())
  const carril = page.getByTestId('carta-tabs')
  expect(await carril.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

for (const consulta of ['pollo', 'aguacate', 'POLLO', 'tequeno', 'queso tocineta']) {
  test(`A4/E6: buscar "${consulta}" devuelve exactamente los platos que coinciden (sin acentos ni mayúsculas, AND entre palabras)`, async ({ page }) => {
    await page.goto(urlCarta())
    await page.getByTestId('carta-buscar-btn').click()
    await page.getByTestId('carta-buscador').fill(consulta)
    const esperados = platosQueCoinciden(consulta).map(p => p.nombre).sort()
    expect(esperados.length, 'el oráculo del xlsx debe tener resultados').toBeGreaterThan(0)
    await expect(visibles(page)).toHaveCount(esperados.length)
    const nombres = (await visibles(page).getByTestId('carta-plato-nombre').allInnerTexts()).map(s => s.trim()).sort()
    expect(nombres).toEqual(esperados)
  })
}

test('E6: "aguacate" encuentra platos que lo tienen solo en la descripción (ingrediente, no en el nombre)', async ({ page }) => {
  await page.goto(urlCarta())
  await page.getByTestId('carta-buscar-btn').click()
  await page.getByTestId('carta-buscador').fill('aguacate')
  const nombres = (await visibles(page).getByTestId('carta-plato-nombre').allInnerTexts()).map(s => s.trim())
  expect(nombres).toEqual(expect.arrayContaining(['Ensalada', 'Ciabatta Clásica', 'Ketomate']))
  expect(nombres.some(n => /aguacate/i.test(n))).toBe(false)
})

test('A4: "picante" no coincide con ningún plato del xlsx → estado vacío, y al borrar vuelve el menú completo', async ({ page }) => {
  await page.goto(urlCarta())
  await page.getByTestId('carta-buscar-btn').click()
  await page.getByTestId('carta-buscador').fill('picante')
  expect(platosQueCoinciden('picante')).toHaveLength(0)
  await expect(visibles(page)).toHaveCount(0)
  await expect(page.getByTestId('carta-sin-resultados')).toBeVisible()
  await page.getByTestId('carta-buscador').fill('')
  await expect(visibles(page)).toHaveCount(PLATOS.length)
  await expect(page.getByTestId('carta-sin-resultados')).toBeHidden()
})

test('E3: plato sin foto = tarjeta tipográfica (inicial como marca de agua), no un ícono genérico; plato con foto muestra imagen', async ({ page }) => {
  await page.goto(urlCarta())
  const sinFoto = page.getByTestId('carta-plato').filter({ hasText: 'Smash Burger' })
  await expect(sinFoto.first()).toHaveAttribute('data-sin-foto', 'true') // tarjeta compacta sin letra gigante
  await expect(sinFoto.locator('img, svg[data-lucide]')).toHaveCount(0)

  const conFoto = page.getByTestId('carta-plato').filter({ hasText: '4to Piso' })
  await expect(conFoto).not.toHaveAttribute('data-sin-foto', 'true')
  await expect(conFoto.locator('img')).toHaveCount(1)
})

test('E3: la foto de lista es 4:5 (medido con boundingBox)', async ({ page }) => {
  await page.goto(urlCarta())
  const caja = await page.getByTestId('carta-plato').filter({ hasText: '4to Piso' }).getByTestId('carta-plato-foto').boundingBox()
  expect(caja).not.toBeNull()
  expect((caja?.width ?? 0) / (caja?.height ?? 1)).toBeCloseTo(4 / 5, 1)
})

test.fixme('E5: "Combos" y "Para compartir" son secciones y tabs antes de las demás — necesita products.carta_section (C2)', async ({ page }) => {
  await page.goto(urlCarta())
  const orden = await page.getByTestId('carta-tabs').locator('[data-testid^="carta-tab-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(orden.slice(0, 2)).toEqual(['carta-tab-combos', 'carta-tab-para-compartir'])
})
