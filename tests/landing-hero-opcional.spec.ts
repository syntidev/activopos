import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { envValue, sql } from './alta-helpers'

/**
 * Landing > Hero con textos opcionales + revalidación inmediata de la portada.
 * Negocio de prueba 217 (zzb-pruebas): pasa a plantilla premium temporal y se restaura; solo toca su propia sección hero.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BIZ = 217
const ADMIN_ID = 162
const HOME = '/catalogo-premium/zzb-pruebas'
const OUT = path.join(__dirname, '..', '.doc', 'landing')
const IMG = '/storage/tenants/217/landing/zzb-hero.png'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let plantilla = ''
let seccionId = 0

const config = (extra: Record<string, string>) => ({ title: '', subtitle: '', cta_text: '', cta_link: '', image_url: IMG, ...extra })

async function sesion(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: ADMIN_ID, businessId: BIZ, role: 'admin', name: 'Admin Carta demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  const foto = await sharp({ create: { width: 1600, height: 700, channels: 3, background: '#274c77' } }).png().toBuffer()
  await page.route('**/storage/tenants/217/landing/**', route => route.fulfill({ body: foto, contentType: 'image/png' }))
}

const limpiar = (): void => { sql(`DELETE FROM landing_sections WHERE business_id=${BIZ} AND type='hero'`) }

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  limpiar()
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BIZ}`)
})

test.afterAll(() => {
  limpiar()
  sql(`UPDATE businesses SET catalog_template='${plantilla}' WHERE id=${BIZ}`)
  expect(sql(`SELECT COUNT(*) FROM landing_sections WHERE business_id=${BIZ} AND type='hero'`)).toBe('0')
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BIZ}`)).toBe(plantilla)
})

test('hero con textos → borrar título, subtítulo y botón guarda 200 y la portada no los muestra; volver a poner uno aparece al recargar', async ({ page }) => {
  await sesion(page)
  const crear = await page.request.post('/api/landing-sections', {
    data: { type: 'hero', config: config({ title: 'ZZB Titulo Hero', subtitle: 'ZZB Subtitulo', cta_text: 'Ver todo', cta_link: '/catalogo-premium/zzb-pruebas/productos' }) },
  })
  expect(crear.status(), await crear.text()).toBe(201)
  seccionId = ((await crear.json()) as { section: { id: number } }).section.id

  await page.goto(HOME)
  await expect(page.getByRole('heading', { name: 'ZZB Titulo Hero' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver todo', exact: true })).toBeVisible()

  // Borra los tres textos: antes 400 (min(1)); ahora 200.
  const vacio = await page.request.patch(`/api/landing-sections/${seccionId}`, { data: { config: config({}) } })
  expect(vacio.status(), await vacio.text()).toBe(200)

  // Sin esperar el TTL: la siguiente carga ya refleja el cambio.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HOME)
  await expect(page.getByText('ZZB Titulo Hero')).toHaveCount(0)
  await expect(page.getByText('ZZB Subtitulo')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver todo', exact: true })).toHaveCount(0)
  await page.screenshot({ path: path.join(OUT, 'hero-sin-textos-1440.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(HOME)
  await page.screenshot({ path: path.join(OUT, 'hero-sin-textos-390.png') })

  // Solo título y texto de botón sin link → aparece el título, no el botón.
  const titulo = await page.request.patch(`/api/landing-sections/${seccionId}`, { data: { config: config({ title: 'ZZB Titulo Nuevo', cta_text: 'Solo texto' }) } })
  expect(titulo.status()).toBe(200)
  await page.goto(HOME)
  await expect(page.getByRole('heading', { name: 'ZZB Titulo Nuevo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Solo texto' })).toHaveCount(0)
})

test('image_url sigue obligatoria y un link inválido sigue rechazado', async ({ page }) => {
  await sesion(page)
  const sinImagen = await page.request.patch(`/api/landing-sections/${seccionId}`, { data: { config: { ...config({}), image_url: '' } } })
  expect(sinImagen.status()).toBe(400)
  const linkMalo = await page.request.patch(`/api/landing-sections/${seccionId}`, { data: { config: config({ cta_text: 'x', cta_link: 'javascript:alert(1)' }) } })
  expect(linkMalo.status()).toBe(400)
})

test('admin: guardar un hero nuevo sin imagen muestra el error en español y nombra el campo', async ({ page }) => {
  await sesion(page)
  limpiar()
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Landing', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar sección' }).click()
  await page.getByRole('button', { name: 'Hero' }).click()
  await page.getByRole('button', { name: 'Guardar' }).last().click()
  await expect(page.getByText(/^Imagen/).first()).toBeVisible()
  await expect(page.getByText(/String must contain/)).toHaveCount(0)
})
