import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { sql } from './alta-helpers'

/**
 * Carta > panel ⓘ "Información del negocio". Negocio propio 217 (zzb-pruebas, plantilla carta):
 * se respaldan y restauran sus campos de contacto, horario y métodos de pago. Capturas en .doc/carta/info/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const SLUG = 'zzb-pruebas'
const OUT = path.join(__dirname, '..', '.doc', 'carta', 'info')
const CARTA = `/catalogo-carta/${SLUG}`
/** Marcadores sintéticos de datos de cobro: JAMÁS deben aparecer en el panel. */
const COBRO = { pago_movil: { phone: '04249990000', ci: 'V-99999999', bank: 'ZZBBancoSecreto' }, cuenta: 'ZZB-CUENTA-0108-1234-5678', zelle: 'zzb-cobro-secreto@example.com' }
const VIEWPORTS = [{ n: '375', w: 375, h: 812 }, { n: '1440', w: 1440, h: 900 }]
const SEMANA = '{"lun":[["11:00","22:00"]],"mar":[["11:00","22:00"]],"mie":[["11:00","22:00"]],"jue":[["11:00","22:00"]],"vie":[["11:00","23:00"]],"sab":[["12:00","23:00"]],"dom":[]}'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] }, permissions: ['clipboard-read', 'clipboard-write'] })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let respaldo: string[] = []
let metodos: { id: string; activo: string }[] = []

const esc = (s: string): string => s.replace(/'/g, "''")

function datos(modo: 'completo' | 'texto' | 'vacio'): void {
  const hojas = modo === 'vacio' ? 0 : 1
  sql(`UPDATE payment_methods SET is_active=${hojas} WHERE business_id=${BIZ}`)
  if (modo === 'vacio') {
    sql(`UPDATE businesses SET phone=NULL, whatsapp=NULL, city=NULL, address=NULL, catalog_instagram=NULL, catalog_hours=NULL, cobro_data='${esc(JSON.stringify(COBRO))}',
         settings=JSON_REMOVE(settings,'$.carta_hours') WHERE id=${BIZ}`)
    return
  }
  const horas = modo === 'completo' ? `JSON_SET(settings,'$.carta_hours',CAST('${SEMANA}' AS JSON))` : `JSON_REMOVE(settings,'$.carta_hours')`
  sql(`UPDATE businesses SET phone='04145550123', whatsapp='584145550123', city='Porlamar', address='Av. Santiago Mariño, Edif. ZZB', catalog_instagram='@zzb_carta',
       catalog_hours='Lunes a sábado de 11 am a 10 pm', cobro_data='${esc(JSON.stringify(COBRO))}', settings=${horas} WHERE id=${BIZ}`)
}

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  const fila = sql(`SELECT QUOTE(phone),QUOTE(whatsapp),QUOTE(city),QUOTE(address),QUOTE(catalog_instagram),QUOTE(catalog_hours),QUOTE(cobro_data),QUOTE(JSON_EXTRACT(settings,'$.carta_hours')) FROM businesses WHERE id=${BIZ}`)
  respaldo = fila.split('\t')
  metodos = sql(`SELECT id,is_active FROM payment_methods WHERE business_id=${BIZ}`).split('\n').filter(Boolean).map(l => { const [id, activo] = l.split('\t'); return { id, activo } })
  expect(respaldo).toHaveLength(8)
})

test.afterAll(() => {
  const horas = respaldo[7] === 'NULL' ? `JSON_REMOVE(settings,'$.carta_hours')` : `JSON_SET(settings,'$.carta_hours',CAST(${respaldo[7]} AS JSON))`
  sql(`UPDATE businesses SET phone=${respaldo[0]}, whatsapp=${respaldo[1]}, city=${respaldo[2]}, address=${respaldo[3]}, catalog_instagram=${respaldo[4]},
       catalog_hours=${respaldo[5]}, cobro_data=${respaldo[6]}, settings=${horas} WHERE id=${BIZ}`)
  for (const m of metodos) sql(`UPDATE payment_methods SET is_active=${m.activo} WHERE id=${m.id}`)
  const ahora = sql(`SELECT QUOTE(phone),QUOTE(whatsapp),QUOTE(city),QUOTE(address),QUOTE(catalog_instagram),QUOTE(catalog_hours),QUOTE(cobro_data),QUOTE(JSON_EXTRACT(settings,'$.carta_hours')) FROM businesses WHERE id=${BIZ}`).split('\t')
  expect(ahora).toEqual(respaldo)
})

const abrir = async (page: Page): Promise<void> => {
  await page.goto(CARTA)
  await page.getByTestId('carta-info-btn').click()
  await expect(page.getByTestId('carta-info-panel')).toBeVisible()
}
const panel = (page: Page) => page.getByTestId('carta-info-panel')

for (const vp of VIEWPORTS) {
  test(`datos completos @${vp.n}: todas las secciones, enlaces correctos y nada de cobro`, async ({ page }) => {
    datos('completo')
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await abrir(page)
    const p = panel(page)
    await expect(p.getByRole('heading', { level: 2 })).toBeVisible()
    await expect(p.getByText('Porlamar').first()).toBeVisible()
    await expect(p.getByTestId('carta-info-estado')).toBeVisible()
    for (const m of ['Efectivo USD', 'Zelle', 'Pago Movil']) await expect(p.getByTestId('carta-info-pagos').getByText(m, { exact: true })).toBeVisible()
    await expect(p.getByTestId('carta-info-whatsapp')).toHaveAttribute('href', 'https://wa.me/584145550123')
    await expect(p.getByTestId('carta-info-instagram')).toHaveAttribute('href', 'https://instagram.com/zzb_carta')
    await expect(p.getByTestId('carta-info-llamar')).toHaveAttribute('href', 'tel:+584145550123')
    await expect(p.getByTestId('carta-info-horario').locator('li')).toHaveCount(7)
    await expect(p.getByTestId('carta-info-direccion').getByRole('link')).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Av\.%20Santiago/)
    // El orden pedido: pagos → contacto → horarios → dirección → compartir
    const titulos = await p.getByRole('heading', { level: 3 }).allInnerTexts()
    expect(titulos.map(t => t.toLowerCase())).toEqual(['métodos de pago', 'contáctanos', 'horarios', 'dirección'])
    // Nunca datos de cobro
    const texto = (await p.textContent()) ?? ''
    const html = await p.innerHTML()
    for (const secreto of ['04249990000', 'V-99999999', 'ZZBBancoSecreto', 'ZZB-CUENTA', 'zzb-cobro-secreto']) {
      expect(texto, secreto).not.toContain(secreto)
      expect(html, secreto).not.toContain(secreto)
    }
    // Zona táctil de 44 px
    for (const b of await p.locator('a, button').all()) expect((await b.boundingBox())!.height, 'zona táctil').toBeGreaterThanOrEqual(43.5)
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT, `info-completo-${vp.n}.png`) })
  })

  test(`datos vacíos @${vp.n}: sin secciones ni títulos huérfanos, solo Compartir`, async ({ page }) => {
    datos('vacio')
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await abrir(page)
    const p = panel(page)
    await expect(p.getByRole('heading', { level: 3 })).toHaveCount(0)
    await expect(p.getByTestId('carta-info-estado')).toHaveCount(0) // sin horario NO se muestra "Cerrado"
    await expect(p.getByText(/Cerrado/)).toHaveCount(0)
    await expect(p.getByTestId('carta-info-compartir')).toBeVisible()
    await expect(p.locator('section')).toHaveCount(0)
    const texto = (await p.textContent()) ?? ''
    expect(texto).not.toContain('04249990000')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(OUT, `info-vacio-${vp.n}.png`) })
  })
}

test('sin carta_hours usa el texto libre catalog_hours y no inventa estado', async ({ page }) => {
  datos('texto')
  await page.setViewportSize({ width: 375, height: 812 })
  await abrir(page)
  const h = panel(page).getByTestId('carta-info-horario')
  await expect(h).toContainText('Lunes a sábado de 11 am a 10 pm')
  await expect(h.locator('li')).toHaveCount(0)
  await expect(panel(page).getByTestId('carta-info-estado')).toHaveCount(0)
})

test('sin Instagram: no hay botón Instagram pero sí WhatsApp y Llamar (sin huecos)', async ({ page }) => {
  datos('completo')
  sql(`UPDATE businesses SET catalog_instagram=NULL WHERE id=${BIZ}`)
  await page.setViewportSize({ width: 375, height: 812 })
  await abrir(page)
  await expect(panel(page).getByTestId('carta-info-instagram')).toHaveCount(0)
  await expect(panel(page).getByTestId('carta-info-whatsapp')).toBeVisible()
  await expect(panel(page).getByTestId('carta-info-llamar')).toBeVisible()
  // Instagram inválido (texto arbitrario) tampoco genera enlace
  sql(`UPDATE businesses SET catalog_instagram='javascript:alert(1)' WHERE id=${BIZ}`)
  await page.reload()
  await page.getByTestId('carta-info-btn').click()
  await expect(panel(page).getByTestId('carta-info-instagram')).toHaveCount(0)
})

test('Compartir: con Web Share usa la URL canónica; sin Web Share copia el enlace y avisa', async ({ page }) => {
  datos('completo')
  const canonica = `${BASE}/c/${SLUG}`
  await page.addInitScript(() => {
    const w = window as unknown as { __compartido: unknown[] }
    w.__compartido = []
    Object.defineProperty(navigator, 'share', { configurable: true, value: (d: unknown) => { w.__compartido.push(d); return Promise.resolve() } })
  })
  await abrir(page)
  await panel(page).getByTestId('carta-info-compartir').click()
  const enviado = await page.evaluate(() => (window as unknown as { __compartido: { url: string }[] }).__compartido)
  expect(enviado).toHaveLength(1)
  expect(enviado[0].url).toBe(canonica)

  const page2 = await page.context().newPage()
  await page2.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }) })
  await abrir(page2)
  await panel(page2).getByTestId('carta-info-compartir').click()
  await expect(panel(page2).getByTestId('carta-info-aviso')).toHaveText('Enlace copiado')
  expect(await page2.evaluate(() => navigator.clipboard.readText())).toBe(canonica)
})

test('a11y: role=dialog+aria-modal, foco atrapado, Esc cierra y el foco vuelve al botón; visible también al bajar', async ({ page }) => {
  datos('completo')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(CARTA)
  await page.evaluate(() => window.scrollTo(0, 1400))
  const btn = page.getByTestId('carta-info-btn')
  await expect(btn).toBeInViewport() // la barra de categorías es sticky: el ⓘ sigue a mano al bajar
  await btn.click()
  const p = panel(page)
  await expect(p).toHaveAttribute('role', 'dialog')
  await expect(p).toHaveAttribute('aria-modal', 'true')
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="carta-info-panel"]')), `Tab ${i}`).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="carta-info-panel"]'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(p).toHaveCount(0)
  await expect(btn).toBeFocused()
})
