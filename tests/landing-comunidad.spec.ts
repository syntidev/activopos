import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'
import { existsSync, rmSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { envValue, sql } from './alta-helpers'

/**
 * Landing > Comunidad: admin (crear, editar con imagen, guardar, ocultar, mostrar, eliminar) y home premium.
 * Negocio 80 (slug boutique-demo), plantilla premium temporal, datos ZZ. Capturas en tests/__capturas__/comunidad/.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 80
const ADMIN_ID = 79
const SLUG = 'boutique-demo'
const HOME = `/catalogo-premium/${SLUG}`
const CAPTURAS = path.join(__dirname, '__capturas__', 'comunidad')
const UPLOAD_DIR = path.join(__dirname, '..', 'storage', 'tenants', String(BUSINESS_ID), 'landing')
const HEADING = 'ZZ Comunidad Garmin'
const HEADING_EDIT = 'ZZ Comunidad Editada'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let originalTemplate = ''
const subidas: string[] = []

const seccionesZZ = (): number => Number(sql(`SELECT COUNT(*) FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`))

async function png(color: string): Promise<Buffer> {
  return sharp({ create: { width: 480, height: 600, channels: 3, background: color } }).png().toBuffer()
}

async function login(page: Page): Promise<void> {
  const token = await new SignJWT({ userId: ADMIN_ID, businessId: BUSINESS_ID, role: 'admin', name: 'Admin Demo' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  page.on('response', async r => {
    if (r.url().endsWith('/api/upload/image') && r.ok()) {
      const j = await r.json().catch(() => null) as { url?: string } | null
      if (j?.url) subidas.push(j.url)
    }
  })
  page.on('dialog', d => { void d.accept() })
  await servirStorage(page)
}

/** En producción nginx sirve /storage; el dev server no, así que se emula leyendo del disco. */
async function servirStorage(page: Page): Promise<void> {
  await page.route('**/storage/tenants/**', route => {
    const file = path.join(__dirname, '..', new URL(route.request().url()).pathname)
    return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 })
  })
}

async function abrirLanding(page: Page): Promise<void> {
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Landing', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Landing del Catálogo' })).toBeVisible()
}

const tarjeta = (page: Page) => page.locator('div', { has: page.getByRole('heading', { name: /Comunidad/ }) }).filter({ has: page.getByRole('button', { name: 'Guardar' }) }).last()

/** La home cachea ~60 s: reintenta hasta que el estado de la sección sea el esperado. */
async function homeMuestra(page: Page, heading: string, visible: boolean): Promise<void> {
  await expect(async () => {
    await page.goto(HOME)
    const h = page.getByRole('heading', { name: heading })
    if (visible) await expect(h).toBeVisible({ timeout: 6000 })
    else await expect(h).toHaveCount(0, { timeout: 6000 })
  }).toPass({ timeout: 120_000, intervals: [2000] })
}

test.beforeAll(() => {
  sql(`DELETE FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`)
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BUSINESS_ID}`)
})

test.afterAll(() => {
  sql(`DELETE FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`)
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BUSINESS_ID}`)
  for (const url of subidas) rmSync(path.join(UPLOAD_DIR, path.basename(url)), { force: true })
  // Confirmación: conteo 0 y plantilla original restaurada.
  expect(seccionesZZ()).toBe(0)
  expect(sql(`SELECT catalog_template FROM businesses WHERE id=${BUSINESS_ID}`)).toBe(originalTemplate)
})

test('admin: crea Comunidad con 2 fotos y la guarda', async ({ page }) => {
  await login(page)
  await abrirLanding(page)
  await page.getByRole('button', { name: 'Agregar sección' }).click()
  await page.getByRole('button', { name: 'Comunidad' }).click()

  const card = tarjeta(page)
  await card.getByLabel('Encabezado').fill(HEADING)
  await card.getByLabel('Subtítulo').fill('Fotos de clientes entrenando')
  const files = card.locator('input[type=file]')
  await files.nth(0).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: await png('#c0392b') })
  await files.nth(1).setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: await png('#2980b9') })
  const tags = card.getByLabel('Texto de la foto (testimonio o frase)')
  await tags.nth(0).fill('Corrí mi primer 10K')
  await tags.nth(1).fill('Sin dolor en la rodilla')
  await expect.poll(() => subidas.length, { timeout: 20_000 }).toBe(2)
  await card.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Sección creada.')).toBeVisible()
  expect(seccionesZZ()).toBe(1)
})

test('admin: edita encabezado y cambia la imagen de una foto', async ({ page }) => {
  await login(page)
  await abrirLanding(page)
  const card = tarjeta(page)
  const q = `SELECT JSON_UNQUOTE(JSON_EXTRACT(config,'$.items[0].image_url')) FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`
  const antes = sql(q)
  await card.getByLabel('Encabezado').fill(HEADING_EDIT)
  const previas = subidas.length
  await card.locator('input[type=file]').nth(0).setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: await png('#27ae60') })
  await expect.poll(() => subidas.length, { timeout: 20_000 }).toBeGreaterThan(previas)
  await card.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Sección guardada.')).toBeVisible()
  expect(sql(q)).not.toBe(antes)
  expect(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(config,'$.heading')) FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`)).toBe(HEADING_EDIT)
})

test('admin: con el mínimo de fotos el botón de borrar explica el motivo', async ({ page }) => {
  await login(page)
  await abrirLanding(page)
  const card = tarjeta(page)
  await expect(card.getByRole('button', { name: 'Eliminar foto 1' })).toBeDisabled()
  await expect(card.getByText('Mínimo 2 fotos').first()).toBeVisible()
  await expect(card.getByLabel('Texto de la foto (testimonio o frase)').first()).toBeVisible()
})

for (const vp of [{ n: '375', width: 375, height: 800 }, { n: '1280', width: 1280, height: 900 }]) {
  test(`home premium muestra Comunidad visible (${vp.n}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await servirStorage(page)
    await homeMuestra(page, HEADING_EDIT, true)
    const sec = page.locator('section', { has: page.getByRole('heading', { name: HEADING_EDIT }) })
    await sec.scrollIntoViewIfNeeded()
    const imgs = sec.locator('img')
    await expect(imgs).toHaveCount(2)
    for (const img of await imgs.all()) {
      await expect(img).toHaveAttribute('loading', 'lazy')
      const box = await img.boundingBox()
      expect(box && box.x >= 0 && box.x + box.width <= vp.width, `foto dentro del viewport ${vp.n}`).toBeTruthy()
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // Centrada: la tab bar flotante del móvil no debe tapar el borde inferior de las fotos.
    await sec.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: path.join(CAPTURAS, `home-comunidad-${vp.n}.png`) })
  })
}

test('admin oculta: desaparece de la home; muestra: vuelve', async ({ page }) => {
  await login(page)
  await abrirLanding(page)
  const card = tarjeta(page)
  await card.getByRole('button', { name: 'Ocultar sección' }).click()
  await expect(card.getByText('Oculta')).toBeVisible()
  await expect(async () => expect(sql(`SELECT visible FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`)).toBe('0')).toPass({ timeout: 10_000 })
  await homeMuestra(page, HEADING_EDIT, false)

  await abrirLanding(page)
  await tarjeta(page).getByRole('button', { name: 'Mostrar sección' }).click()
  await expect(async () => expect(sql(`SELECT visible FROM landing_sections WHERE business_id=${BUSINESS_ID} AND type='community'`)).toBe('1')).toPass({ timeout: 10_000 })
  await homeMuestra(page, HEADING_EDIT, true)
})

test('admin elimina: conteo 0 y fuera de la home', async ({ page }) => {
  await login(page)
  await abrirLanding(page)
  await tarjeta(page).getByRole('button', { name: 'Eliminar sección' }).click()
  await expect(page.getByText('Sección eliminada.')).toBeVisible()
  expect(seccionesZZ()).toBe(0)
  await homeMuestra(page, HEADING_EDIT, false)
})
