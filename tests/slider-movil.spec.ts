import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { SignJWT } from 'jose'
import { envValue, sql } from './alta-helpers'
import { ensureOwnBusiness, OWN_SLUG } from './helpers/own-business-carta'

/**
 * Slider móvil: portadas de la Carta y slider premium. Enfoque (object-position), imagen móvil por <picture>, "Mostrar en" (los puntos cuentan
 * solo los visibles), 4:5 en móvil, prioridad de la primera imagen y panel (cruz de enfoque, vista previa y aviso de tamaño).
 * Negocio propio 217 (prefijo ZZB). Usa imágenes de /public para no depender de archivos subidos.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const IMG = ['/brand/cashea.png', '/activopos-logo-flat-positive.svg', '/activopos-logo-negative.svg']
const MOVIL = '/storage/tenants/217/zzb-movil.webp' // la API solo acepta rutas propias (/storage/tenants/…)
let bid = 0
const q = (query: string): string => sql(query.replace(/@BID/g, String(bid)))

const ARCHIVO_MOVIL = path.join(__dirname, '..', 'storage', 'tenants', '217', 'zzb-movil.webp')

test.beforeAll(() => {
  bid = ensureOwnBusiness()
  fs.mkdirSync(path.dirname(ARCHIVO_MOVIL), { recursive: true })
  fs.copyFileSync(path.join(__dirname, '..', 'public', 'activopos-logo-flat-positive.png'), ARCHIVO_MOVIL) // existe de verdad: un 404 haría que la imagen se retire
  q("UPDATE businesses SET catalog_cover_path='" + IMG[0] + "', catalog_cover_path_2='" + IMG[1] + "', catalog_cover_path_3='" + IMG[2] + "', settings=JSON_SET(settings,'$.carta_cover_meta',JSON_OBJECT('1',JSON_OBJECT('mobile_path','" + MOVIL + "','focus_x',20,'focus_y',70,'show_on','all'),'2',JSON_OBJECT('mobile_path',NULL,'focus_x',50,'focus_y',50,'show_on','desktop'),'3',JSON_OBJECT('mobile_path',NULL,'focus_x',50,'focus_y',50,'show_on','mobile'))) WHERE id=@BID")
})
test.afterAll(() => {
  fs.rmSync(ARCHIVO_MOVIL, { force: true })
  q("UPDATE businesses SET catalog_cover_path=NULL, catalog_cover_path_2=NULL, catalog_cover_path_3=NULL, catalog_template='carta', settings=JSON_REMOVE(settings,'$.carta_cover_meta') WHERE id=@BID")
  q("DELETE FROM landing_sections WHERE business_id=@BID AND type='event_slider'")
  ensureOwnBusiness()
})

test('portadas Carta: nunca deforman (cover + enfoque), <picture> móvil, "Mostrar en", puntos visibles, 4:5 y prioridad', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/catalogo-carta/' + OWN_SLUG)
  const portada = page.getByTestId('carta-portada-negocio')
  const primera = portada.locator('img').first()
  expect(await primera.evaluate(el => getComputedStyle(el).objectFit)).toBe('cover')
  expect(await primera.evaluate(el => getComputedStyle(el).objectPosition)).toBe('20% 70%') // punto de enfoque
  await expect(portada.locator('source[media="(max-width: 640px)"]').first()).toHaveAttribute('srcset', MOVIL) // imagen móvil
  await expect(primera).toHaveAttribute('fetchpriority', 'high') // la primera, con prioridad y sin lazy
  await expect(primera).not.toHaveAttribute('loading', 'lazy')
  const caja = (await portada.boundingBox())!
  expect(Math.abs(caja.width / caja.height - 0.8)).toBeLessThan(0.02) // 4:5 en móvil
  // Móvil: portadas 1 y 3 (la 2 es solo escritorio) → 2 puntos
  await expect(portada.locator('[class*="portadaDots"] i')).toHaveCount(2)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(portada.locator('[class*="portadaDots"] i')).toHaveCount(2) // escritorio: 1 y 2 (la 3 es solo móvil)
  await expect(portada.locator('img').nth(1)).toHaveAttribute('loading', 'lazy') // las demás, lazy
})

test('panel: clic en la miniatura marca el enfoque (cruz), vista previa teléfono/escritorio y aviso de foto chica', async ({ page, context }) => {
  const admin = Number(q("SELECT id FROM users WHERE business_id=@BID AND role='admin' ORDER BY id LIMIT 1"))
  const token = await new SignJWT({ userId: admin, businessId: bid, role: 'admin', name: 'ZZB Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await context.addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Carta', exact: true }).click()
  const picker = page.getByTestId('portada-1-enfoque')
  await expect(picker).toBeVisible()
  await expect(page.getByTestId('portada-1-cruz')).toBeVisible()
  const r = (await picker.boundingBox())!
  await picker.click({ position: { x: r.width * 0.3, y: r.height * 0.4 } })
  await expect.poll(() => q("SELECT CONCAT(JSON_EXTRACT(settings,'$.carta_cover_meta.\"1\".focus_x'),'|',JSON_EXTRACT(settings,'$.carta_cover_meta.\"1\".focus_y')) FROM businesses WHERE id=@BID"), { timeout: 15_000 }).toMatch(/^(2[89]|3[0-2])\|(3[89]|4[0-2])$/)
  await expect(page.getByTestId('portada-1-previa-movil')).toBeVisible()
  await expect(page.getByTestId('portada-1-previa-escritorio')).toBeVisible()
  await expect(page.getByTestId('portada-1-aviso-escritorio')).toContainText('1920×800')
  await expect(page.getByTestId('portada-2-aviso-vertical')).toContainText('1080×1350') // sin imagen móvil: aviso de subir la vertical
  await expect(page.getByTestId('portada-1-aviso-vertical')).toHaveCount(0)
})

test('slider premium: "Mostrar en" filtra slides y puntos; sin imagen móvil conserva su proporción (no 4:5)', async ({ page }) => {
  const slide = (n: number, show: string, img: string) => "JSON_OBJECT('title','S" + n + "','subtitle','x','cta_text','Ver','cta_link','/catalogo-premium/" + OWN_SLUG + "','image_url','" + img + "','show_on','" + show + "')"
  q("DELETE FROM landing_sections WHERE business_id=@BID AND type='event_slider'")
  q("INSERT INTO landing_sections (business_id,type,`order`,visible,config,created_at,updated_at) VALUES (@BID,'event_slider',1,1,JSON_OBJECT('slides',JSON_ARRAY(" + [slide(1, 'all', '/storage/tenants/217/x.webp'), slide(2, 'desktop', '/storage/tenants/217/y.webp'), slide(3, 'mobile', '/storage/tenants/217/z.webp')].join(',') + ")),NOW(3),NOW(3))")
  q("UPDATE businesses SET catalog_template='premium' WHERE id=@BID")
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/catalogo-premium/' + OWN_SLUG)
  const slider = page.locator('[aria-roledescription="carrusel"]').first()
  await expect(slider).toBeVisible()
  await expect(slider.locator('[class*="lsSliderDots"] span')).toHaveCount(2) // móvil: slides 1 y 3
  const caja = (await slider.boundingBox())!
  expect(caja.width / caja.height, 'sin mobile_path NO pasa a 4:5').toBeGreaterThan(1.5)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(slider.locator('[class*="lsSliderDots"] span')).toHaveCount(2) // escritorio: slides 1 y 2
  q("UPDATE businesses SET catalog_template='carta' WHERE id=@BID")
})
