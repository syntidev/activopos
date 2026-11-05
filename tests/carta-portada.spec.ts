import { test, expect } from '@playwright/test'
import { sql, USER_ID } from './alta-helpers'
import { BASE, SLUG, PLATOS, sembrarCarta, limpiarCarta, ajustarSettings, urlCarta, sinScrollHorizontal, violacionesAxe } from './carta-helpers'

/**
 * Carta · portada, hero, "De la casa", franja de pago, presets, responsive y accesibilidad.
 * SPEC §4.1, §12.1, §12.8 (E1-E4, E9-E13), §13, A1, A2 (abierto), A7, A8. Contrato de selectores: .doc/carta/TESTIDS.md.
 * Se escribió ANTES del código: hoy TODA la suite falla por falta de /catalogo-carta/[slug].
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 60_000 })

const FAVORITOS = PLATOS.filter(p => p.destacado).map(p => p.nombre) // 4to Piso, Baconise Triple

test.beforeAll(() => { sembrarCarta({ slug: SLUG }) })
test.afterAll(() => { limpiarCarta(SLUG); limpiarCarta('zz-carta-generic') })

test('A1: negocio con plantilla carta abre /catalogo-carta/[slug]; con otra plantilla responde 404', async ({ page, request }) => {
  const ok = await page.goto(urlCarta())
  expect(ok?.status()).toBe(200)
  await expect(page.getByTestId('carta-root')).toBeVisible()

  sembrarCarta({ slug: 'zz-carta-generic' })
  sql("UPDATE businesses SET catalog_template='generic' WHERE catalog_slug='zz-carta-generic'")
  const res = await request.get(urlCarta('zz-carta-generic'))
  expect(res.status()).toBe(404)
})

test('A2: la portada muestra nombre, estado Abierto con hora de cierre y el horario completo', async ({ page }) => {
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-nombre')).toContainText('Café con Bike')
  await expect(page.getByTestId('carta-estado')).toContainText(/Abierto · cierra a las/i)
  await expect(page.getByTestId('carta-horario')).toBeVisible()
  await expect(page.getByTestId('carta-horario')).toContainText(/lun/i)
  await expect(page.getByTestId('carta-horario')).toContainText(/domingo|dom/i)
})

test('E1: sin ventas el hero se rotula "Recomendados" y muestra los destacados del xlsx (4to Piso, Baconise Triple)', async ({ page }) => {
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-hero-titulo')).toHaveText('Recomendados')
  const slides = page.getByTestId('carta-hero-slide')
  await expect(slides).toHaveCount(FAVORITOS.length)
  for (const nombre of FAVORITOS) await expect(slides.filter({ hasText: nombre })).toHaveCount(1)
  await expect(page.getByTestId('carta-hero')).toHaveAttribute('aria-roledescription', 'carrusel')
})

test('E1: con ventas pagadas de 30 días el hero pasa a "Los favoritos de la casa" ordenado por unidades', async ({ page }) => {
  const bid = sql(`SELECT id FROM businesses WHERE catalog_slug='${SLUG}'`)
  const smash = sql(`SELECT id FROM products WHERE business_id=${bid} AND name='Smash Burger'`)
  sql(`INSERT INTO sales (business_id, cashier_id, ticket_number, status, total_usd, total_bs, rate_used, updated_at) VALUES (${bid}, ${USER_ID}, 'ZZ-CARTA-1', 'paid', 110, 110, 1, NOW(3))`)
  const venta = sql(`SELECT id FROM sales WHERE business_id=${bid} AND ticket_number='ZZ-CARTA-1' ORDER BY id DESC LIMIT 1`)
  sql(`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price_per_unit_usd, subtotal_usd, subtotal_bs, rate_used, sale_mode, unit_label) VALUES (${venta}, ${smash}, 'Smash Burger', 10, 11, 110, 110, 1, 'unit', 'und')`)
  try {
    await page.goto(urlCarta())
    await expect(page.getByTestId('carta-hero-titulo')).toHaveText('Los favoritos de la casa')
    await expect(page.getByTestId('carta-hero-slide').first()).toContainText('Smash Burger')
    await expect(page.getByTestId('carta-hero-slide').first()).toContainText(/N\.º 1 de la casa/)
  } finally {
    sql(`DELETE FROM sale_items WHERE sale_id=${venta}`)
    sql(`DELETE FROM sales WHERE id=${venta}`)
  }
})

test('E2: el hero avanza solo cada 5 s, se detiene con el mouse y no avanza con prefers-reduced-motion', async ({ page, browser }) => {
  await page.goto(urlCarta())
  const activo = (p: typeof page) => p.getByTestId('carta-hero-slide').and(p.locator('[data-activo="true"]'))
  const primero = (await activo(page).innerText()).trim()
  await expect.poll(async () => (await activo(page).innerText()).trim(), { timeout: 8_000 }).not.toBe(primero)

  await page.getByTestId('carta-hero').hover()
  const quieto = (await activo(page).innerText()).trim()
  await page.waitForTimeout(5_500)
  expect((await activo(page).innerText()).trim()).toBe(quieto)

  const ctx = await browser.newContext({ baseURL: BASE, reducedMotion: 'reduce' })
  const quieta = await ctx.newPage()
  await quieta.goto(urlCarta())
  const a = (await activo(quieta).innerText()).trim()
  await quieta.waitForTimeout(6_000)
  expect((await activo(quieta).innerText()).trim()).toBe(a)
  await ctx.close()
})

test('E12: a 1280 px "De la casa" tiene 3 tarjetas fotográficas SIN repetir los del hero y hay una banda de ambiente', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(urlCarta())
  const cards = page.getByTestId('carta-de-la-casa-card')
  await expect(cards).toHaveCount(3)
  const enHero = await page.getByTestId('carta-hero-nombre').allInnerTexts()
  const enCasa = await page.getByTestId('carta-de-la-casa-nombre').allInnerTexts()
  expect(enCasa.filter(n => enHero.includes(n)), 'favoritos del hero repetidos en "De la casa"').toEqual([])
  expect(await page.getByTestId('carta-banda').count()).toBeGreaterThanOrEqual(1)
})

test('E12: a 375 px "De la casa" no se muestra', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-root')).toBeVisible()
  await expect(page.getByTestId('carta-de-la-casa')).toBeHidden()
})

test('E10 + §13.3: ningún plato muestra chips [Bs]/[Cashea]; la franja "Cómo pagas" aparece una vez; precio $ grande y Bs pequeño debajo', async ({ page }) => {
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-franja-pago')).toHaveCount(1)
  await expect(page.getByTestId('carta-franja-pago')).toContainText(/Cómo pagas/i)
  const platos = page.getByTestId('carta-plato')
  expect(await platos.count()).toBe(PLATOS.length)
  await expect(platos.getByText(/cashea/i)).toHaveCount(0)
  await expect(platos.getByTestId('carta-chip-bs')).toHaveCount(0)
  const smash = platos.filter({ hasText: 'Smash Burger' })
  await expect(smash.getByTestId('carta-plato-precio-usd')).toHaveText('$11.00')
  await expect(smash.getByTestId('carta-plato-precio-bs')).toHaveText(/^Bs\. [\d,]+\.\d{2}$/)
  // Precio Divisa vigente (0 < divisa < lista): "Pechuga de Pollo Asada" lista $14 → Divisa $12.
  await expect(platos.filter({ hasText: 'Pechuga de Pollo Asada' }).getByTestId('carta-plato-precio-usd')).toHaveText('$12.00')
})

test('A7: ninguna página de la Carta contiene el texto "Full"', async ({ page }) => {
  await page.goto(urlCarta())
  await expect(page.getByTestId('carta-root')).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/\bFull\b/)
})

test('E4 + E11: nombres con la serif cargada; IBM Plex Mono no está en ninguna página; sin fondo blanco tras las fotos', async ({ page }) => {
  await page.goto(urlCarta())
  await page.evaluate(() => document.fonts.ready)
  const fuentes = await page.evaluate(() => Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')))
  expect(fuentes.some(f => /Fraunces/i.test(f)), `fuentes cargadas: ${fuentes.join(', ')}`).toBe(true)
  expect(fuentes.some(f => /IBM Plex Mono/i.test(f))).toBe(false)
  const familia = await page.getByTestId('carta-plato-nombre').first().evaluate(el => getComputedStyle(el).fontFamily)
  expect(familia).toMatch(/Fraunces/i)
  const fondo = await page.getByTestId('carta-plato-foto').first().evaluate(el => getComputedStyle(el).backgroundColor)
  expect(fondo).not.toBe('rgb(255, 255, 255)')
})

test('E13: 0 imágenes rotas y todas con texto alternativo', async ({ page }) => {
  await page.goto(urlCarta())
  await page.waitForLoadState('networkidle')
  const rotas = await page.evaluate(() => Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src))
  expect(rotas).toEqual([])
  const sinAlt = await page.evaluate(() => Array.from(document.images).filter(i => !(i.getAttribute('alt') ?? '').trim()).length)
  expect(sinAlt).toBe(0)
})

for (const ancho of [375, 1280]) {
  test(`A8 + E9: ${ancho} px sin scroll horizontal en portada y lista, en las dos direcciones (casual y fine)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ancho === 375 ? 812 : 900 })
    for (const style of ['casual', 'fine'] as const) {
      ajustarSettings(SLUG, { carta_style: style })
      await page.goto(urlCarta())
      await expect(page.getByTestId('carta-root')).toHaveAttribute('data-carta-style', style)
      await sinScrollHorizontal(page)
    }
    ajustarSettings(SLUG, { carta_style: 'casual' })
  })
}

test('presets: cambiar carta_style cambia los tokens (acento, serif y forma del botón)', async ({ page }) => {
  const leer = () => page.getByTestId('carta-root').evaluate(el => ({
    acento: getComputedStyle(el).getPropertyValue('--acento').trim().toLowerCase(),
    serif: getComputedStyle(el.querySelector('[data-testid="carta-plato-nombre"]') as Element).fontFamily,
    radio: getComputedStyle(el.querySelector('[data-testid="carta-plato-agregar"]') as Element).borderRadius,
  }))
  ajustarSettings(SLUG, { carta_style: 'casual' })
  await page.goto(urlCarta())
  const casual = await leer()
  expect(casual.acento).toBe('#b8381a') // brasa por defecto (SPEC §12.3)
  expect(casual.serif).toMatch(/Fraunces/i)

  ajustarSettings(SLUG, { carta_style: 'fine' })
  await page.goto(urlCarta())
  const fine = await leer()
  expect(fine.acento).toBe('#8a6a2f') // oro viejo en fine dining
  expect(fine.serif).toMatch(/Cormorant/i)
  expect(fine.radio).not.toBe(casual.radio) // botón cuadrado de contorno vs. píldora
  ajustarSettings(SLUG, { carta_style: 'casual' })
})

for (const ancho of [375, 1280]) {
  test(`accesibilidad básica (axe wcag2a/aa) a ${ancho} px: sin errores serios ni críticos`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto(urlCarta())
    await expect(page.getByTestId('carta-root')).toBeVisible()
    expect(await violacionesAxe(page)).toEqual([])
  })
}
