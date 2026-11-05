import { test, expect, type Page } from '@playwright/test'
import { sql } from './alta-helpers'
import {
  BASE, SLUG, WHATSAPP, CEDULA, sembrarCarta, limpiarCarta, urlCarta, plato, tamanosDe, usd, bs, redondeo, tasaBcv,
  capturarWhatsApp, textoDeWhatsApp, mensajeEsperado, sinScrollHorizontal,
} from './carta-helpers'

/**
 * Carta · del plato al pedido: tamaños, cantidad y nota, barra "Ver mi pedido", carrito, mensaje de WhatsApp y Order en DB.
 * SPEC §4.4-4.8, §7, §12.5, A5-A6, A9, E7. Contrato de selectores y del mensaje: .doc/carta/TESTIDS.md.
 * Datos del xlsx: Lomito de Res 200/250/300 g = $22/$26/$28 (default el menor); Tequeños de Queso $7.
 */
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ timeout: 60_000 })

const LOMITO = 'Lomito de Res'
const TEQUENOS = 'Tequeños de Queso'
const NOTA = 'sin cebolla'
const tasa = (): number => tasaBcv()

test.beforeAll(() => { sembrarCarta({ slug: SLUG }) })
test.afterAll(() => { limpiarCarta(SLUG) })

const platoEnLista = (page: Page, nombre: string) => page.getByTestId('carta-plato').filter({ hasText: nombre })
const barra = (page: Page) => page.getByTestId('carta-barra-pedido')

async function abrirFicha(page: Page, nombre: string): Promise<void> {
  await page.goto(urlCarta())
  await platoEnLista(page, nombre).getByTestId('carta-plato-nombre').click()
  await expect(page.getByTestId('carta-ficha')).toBeVisible()
}

/** Lomito 250 g ×2 con nota + Tequeños ×1 = $59.00. Deja el carrito armado en la lista. */
async function armarPedido(page: Page): Promise<void> {
  await abrirFicha(page, LOMITO)
  await page.locator('[data-testid="carta-tamano"][data-tamano="250 g"]').click()
  await page.getByTestId('carta-cantidad-mas').click()
  await page.getByTestId('carta-nota').fill(NOTA)
  await page.getByTestId('carta-ficha-agregar').click()
  await page.goto(urlCarta())
  await platoEnLista(page, TEQUENOS).getByTestId('carta-plato-agregar').click()
}

test('tamaños: Lomito de Res ofrece 200/250/300 g, arranca en el menor y el precio cambia al elegir', async ({ page }) => {
  await abrirFicha(page, LOMITO)
  const tamanos = tamanosDe(LOMITO)
  expect(tamanos.map(t => t.tamano)).toEqual(['200 g', '250 g', '300 g'])
  await expect(page.getByTestId('carta-tamano')).toHaveCount(3)
  await expect(page.locator('[data-testid="carta-tamano"][data-tamano="200 g"]')).toBeChecked()
  await expect(page.getByTestId('carta-ficha-precio')).toHaveText(usd(22))
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText(`Agregar · ${usd(22)}`)
  for (const t of tamanos) {
    await page.locator(`[data-testid="carta-tamano"][data-tamano="${t.tamano}"]`).click()
    await expect(page.getByTestId('carta-ficha-precio')).toHaveText(usd(t.precio))
    await expect(page.getByTestId('carta-ficha-agregar')).toContainText(`Agregar · ${usd(t.precio)}`)
  }
})

test('cantidad y nota: el botón suma por cantidad, la cantidad no baja de 1 y la nota se acepta', async ({ page }) => {
  await abrirFicha(page, LOMITO)
  await page.locator('[data-testid="carta-tamano"][data-tamano="250 g"]').click()
  await expect(page.getByTestId('carta-cantidad-valor')).toHaveText('1')
  await page.getByTestId('carta-cantidad-menos').click()
  await expect(page.getByTestId('carta-cantidad-valor')).toHaveText('1')
  await page.getByTestId('carta-cantidad-mas').click()
  await expect(page.getByTestId('carta-cantidad-valor')).toHaveText('2')
  await expect(page.getByTestId('carta-ficha-agregar')).toContainText(`Agregar · ${usd(52)}`)
  await page.getByTestId('carta-nota').fill(NOTA)
  await expect(page.getByTestId('carta-nota')).toHaveValue(NOTA)
})

test('A6: "Agregar" en un plato simple suma al carrito sin abrir la ficha; en uno con tamaños abre la ficha', async ({ page }) => {
  await page.goto(urlCarta())
  await platoEnLista(page, TEQUENOS).getByTestId('carta-plato-agregar').click()
  await expect(page).toHaveURL(new RegExp(`${urlCarta()}/?$`))
  await expect(page.getByTestId('carta-barra-cantidad')).toHaveText('1')
  await platoEnLista(page, LOMITO).getByTestId('carta-plato-agregar').click()
  await expect(page.getByTestId('carta-ficha')).toBeVisible()
  await expect(page).toHaveURL(/\/p\/\d+/)
})

test('barra "Ver mi pedido": fija y visible, con cantidad y total en USD y Bs correctos tras agregar', async ({ page }) => {
  await armarPedido(page)
  const total = plato(TEQUENOS).precio + 2 * tamanosDe(LOMITO)[1].precio // 7 + 2×26 = 59
  expect(total).toBe(59)
  await expect(barra(page)).toBeVisible()
  await expect(barra(page)).toContainText('Ver mi pedido')
  await expect(page.getByTestId('carta-barra-cantidad')).toHaveText('3')
  await expect(page.getByTestId('carta-barra-total-usd')).toHaveText(usd(total))
  await expect(page.getByTestId('carta-barra-total-bs')).toHaveText(bs(redondeo(total * tasa())))
  // Fija: sigue en pantalla aunque se baje hasta el final de la carta.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
  await expect(barra(page)).toBeInViewport()
})

test('E7: la barra sube al agregar desde el hero', async ({ page }) => {
  await page.goto(urlCarta())
  await page.getByTestId('carta-hero-agregar').first().click()
  await expect(page.getByTestId('carta-barra-cantidad')).toHaveText('1')
  await expect(page.getByTestId('carta-barra-total-usd')).toHaveText(/^\$\d+\.\d{2}$/)
})

test('el carrito persiste al recargar la página', async ({ page }) => {
  await armarPedido(page)
  await page.reload()
  await expect(page.getByTestId('carta-barra-cantidad')).toHaveText('3')
})

test('carrito: líneas con tamaño y nota, editar cantidad, y quitar pide confirmación (cancelar conserva, confirmar quita)', async ({ page }) => {
  await armarPedido(page)
  await barra(page).click()
  const carrito = page.getByTestId('carta-carrito')
  await expect(carrito).toBeVisible()
  const lineas = carrito.getByTestId('carta-linea')
  await expect(lineas).toHaveCount(2)

  const lomito = lineas.filter({ hasText: LOMITO })
  await expect(lomito.getByTestId('carta-linea-detalle')).toContainText('250 g')
  await expect(lomito.getByTestId('carta-linea-detalle')).toContainText(NOTA)
  await expect(lomito.getByTestId('carta-linea-cantidad')).toHaveText('2')
  await expect(lomito.getByTestId('carta-linea-total')).toHaveText(usd(52))
  await expect(page.getByTestId('carta-total-usd')).toHaveText(usd(59))
  await expect(page.getByTestId('carta-total-bs')).toHaveText(bs(redondeo(59 * tasa())))

  // Editar: Tequeños 1 → 2 sube el total; volver a 1 lo baja.
  const tequenos = lineas.filter({ hasText: TEQUENOS })
  await tequenos.getByTestId('carta-linea-mas').click()
  await expect(tequenos.getByTestId('carta-linea-total')).toHaveText(usd(14))
  await expect(page.getByTestId('carta-total-usd')).toHaveText(usd(66))
  await tequenos.getByTestId('carta-linea-menos').click()
  await expect(page.getByTestId('carta-total-usd')).toHaveText(usd(59))

  // Quitar: confirmación; cancelar conserva la línea.
  await tequenos.getByTestId('carta-linea-quitar').click()
  await expect(page.getByTestId('carta-quitar-dialogo')).toBeVisible()
  await page.getByTestId('carta-quitar-cancelar').click()
  await expect(lineas).toHaveCount(2)
  await tequenos.getByTestId('carta-linea-quitar').click()
  await page.getByTestId('carta-quitar-confirmar').click()
  await expect(lineas).toHaveCount(1)
  await expect(page.getByTestId('carta-total-usd')).toHaveText(usd(52))
  await expect(page.getByTestId('carta-total-bs')).toHaveText(bs(redondeo(52 * tasa())))
})

test('A8: el carrito y la ficha no desbordan a 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await armarPedido(page)
  await barra(page).click()
  await expect(page.getByTestId('carta-carrito')).toBeVisible()
  await sinScrollHorizontal(page)
})

test('A9 + C1: enviar crea el Order origin=catalog y abre WhatsApp con el mensaje completo y exacto', async ({ page, context }) => {
  const enlaces = capturarWhatsApp(context)
  await armarPedido(page)
  await barra(page).click()

  await page.getByTestId('carta-modalidad-llevar').click()
  await page.getByTestId('carta-nombre-cliente').fill('Maria Perez')
  await page.getByTestId('carta-telefono').fill('04141234567')
  await page.getByTestId('carta-cedula').fill(CEDULA)
  const pagoBs = page.getByTestId('carta-pago-bs')
  await pagoBs.click()
  const etiquetaPago = (await pagoBs.innerText()).trim()

  const [peticion] = await Promise.all([
    page.waitForRequest(r => r.url().includes(`/api/catalog/${SLUG}/order`) && r.method() === 'POST'),
    page.getByTestId('carta-enviar').click(),
  ])
  // Anti price-tampering: el cliente manda ids y cantidades, nunca precios ni totales.
  const cuerpo = peticion.postDataJSON() as { items: Record<string, unknown>[]; customer_reference: string }
  expect(cuerpo.items).toHaveLength(2)
  for (const it of cuerpo.items) expect(Object.keys(it)).toEqual(expect.not.arrayContaining(['price_usd']))
  expect(cuerpo.customer_reference).toBe('Para llevar')

  await expect(page.getByTestId('carta-confirmacion')).toBeVisible()
  const negocio = `(SELECT id FROM businesses WHERE catalog_slug='${SLUG}')`
  const [numero, origen, totalUsd, totalBs, notas] = sql(`SELECT order_number, origin, total_usd, total_bs, notes FROM orders WHERE business_id=${negocio} ORDER BY id DESC LIMIT 1`).split('\t')
  expect(origen).toBe('catalog')
  expect(numero).toMatch(/^CT-\d{4,}$/)
  expect(Number(totalUsd)).toBe(59)
  expect(Math.abs(Number(totalBs) - redondeo(59 * tasa()))).toBeLessThanOrEqual(0.01)
  expect(notas).toContain(NOTA)
  const linea = sql(`SELECT CONCAT(quantity,'|',variant_label,'|',price_per_unit_usd) FROM order_items WHERE order_id=(SELECT id FROM orders WHERE order_number='${numero}' AND business_id=${negocio}) AND product_name='${LOMITO}'`)
  expect(linea).toMatch(/^2\.000\|.*250 g.*\|26\.0000$/)

  await expect(page.getByTestId('carta-numero-pedido')).toHaveText(numero)
  await expect.poll(() => enlaces.length).toBeGreaterThan(0)
  expect(enlaces[0]).toContain(`/${WHATSAPP}`)
  const esperado = mensajeEsperado({
    numero, negocio: 'Café con Bike', modalidad: 'Para llevar', cliente: 'Maria Perez', telefono: '04141234567', pago: etiquetaPago, tasa: tasa(),
    lineas: [
      { cantidad: 2, nombre: LOMITO, detalle: '250 g', subtotal: 52, nota: NOTA },
      { cantidad: 1, nombre: TEQUENOS, subtotal: 7 },
    ],
  })
  expect(textoDeWhatsApp(enlaces[0])).toBe(esperado)
  await expect(page.getByTestId('carta-mensaje-wa')).toHaveText(esperado)
})

test('A9: con el registro caído el mensaje de WhatsApp se envía igual (respaldo) y se avisa', async ({ page, context }) => {
  const enlaces = capturarWhatsApp(context)
  await armarPedido(page)
  await page.route(`**/api/catalog/${SLUG}/order`, r => r.abort())
  await barra(page).click()
  await page.getByTestId('carta-modalidad-aqui').click()
  await page.getByTestId('carta-nombre-cliente').fill('Maria Perez')
  await page.getByTestId('carta-telefono').fill('04141234567')
  await page.getByTestId('carta-cedula').fill(CEDULA)
  await page.getByTestId('carta-pago-bs').click()
  await page.getByTestId('carta-enviar').click()
  await expect(page.getByTestId('carta-aviso-respaldo')).toBeVisible()
  await expect.poll(() => enlaces.length).toBeGreaterThan(0)
  expect(textoDeWhatsApp(enlaces[0])).toContain('Modalidad: Comer aquí')
})
