import { test, expect, request as pwRequest, type Page } from '@playwright/test'
import { existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import sharp from 'sharp'
import { SignJWT } from 'jose'
import { envValue } from './alta-helpers'

/**
 * Fotos del formulario de producto (negocio 87, servidor local; E2E_BASE_URL para otro puerto).
 * Regresión P0: las casillas dejaron de aceptar archivos porque el límite de subidas era por IP y, sin
 * X-Real-IP / cf-connecting-ip, todos los negocios compartían un solo contador (20 por minuto).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BUSINESS_ID = 87
const ADMIN_A = 86
const ADMIN_B = 104
const ROOT = path.join(__dirname, '..')

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial' })

async function tokenFor(userId: number): Promise<string> {
  return new SignJWT({ userId, businessId: BUSINESS_ID, role: 'admin', name: 'Admin OnBike' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
}

async function login(page: Page, userId = ADMIN_A): Promise<void> {
  await page.context().addCookies([{ name: 'activopos_session', value: await tokenFor(userId), url: BASE }])
}

const FORMATS = ['png', 'jpg', 'webp'] as const
const files: Record<(typeof FORMATS)[number], string> = { png: '', jpg: '', webp: '' }
const createdIds: number[] = []

test.beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fotos-e2e-'))
  const base = sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 40, b: 40 } } })
  files.png = path.join(dir, 'foto.png');   await base.clone().png().toFile(files.png)
  files.jpg = path.join(dir, 'foto.jpg');   await base.clone().jpeg().toFile(files.jpg)
  files.webp = path.join(dir, 'foto.webp'); await base.clone().webp().toFile(files.webp)
})

test.afterAll(async () => {
  const api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(ADMIN_A)}` } })
  for (const id of createdIds) await api.delete(`/api/products/${id}`)
  await api.dispose()
})

/** Clic real en "Foto N" -> selector de archivos -> elegir archivo -> espera el 201 de la subida. */
async function subirEnCasilla(page: Page, n: number, file: string): Promise<string> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: `Foto ${n}`, exact: true }).click(),
  ])
  const respuesta = page.waitForResponse(r => r.url().includes('/api/upload/image') && r.request().method() === 'POST')
  await chooser.setFiles(file)
  const r = await respuesta
  expect(r.status(), 'la subida debe responder 201').toBe(201)
  await expect(page.getByAltText(`Foto ${n}`)).toHaveCount(1)
  return (await r.json()).url as string
}

const enDisco = (url: string): boolean => existsSync(path.join(ROOT, url.replace(/^\//, '')))

/** GET /api/products/[id] devuelve `images` tal como está en la DB: texto JSON (o null). */
async function imagenesDe(page: Page, id: number): Promise<string[]> {
  const raw = (await (await page.request.get(`/api/products/${id}`)).json()).product.images as string | string[] | null
  if (!raw) return []
  return typeof raw === 'string' ? (JSON.parse(raw) as string[]) : raw
}

test('alta nueva: una casilla acepta png, jpg y webp y la 6ª casilla también; el producto queda guardado con sus fotos', async ({ page }) => {
  await login(page)
  await page.goto('/productos/nuevo')
  await expect(page.locator('input[type=file]')).toHaveCount(6)
  await page.locator('#np-name').fill('ZZ Foto E2E alta')
  await page.locator('#np-cost').fill('1') // el precio se calcula solo desde costo y margen

  // una MISMA casilla con los tres formatos (se vacía entre uno y otro)
  for (const fmt of FORMATS) {
    await subirEnCasilla(page, 1, files[fmt])
    if (fmt !== 'webp') await page.getByRole('button', { name: 'Eliminar foto 1' }).click()
  }
  const urlSexta = await subirEnCasilla(page, 6, files.png)

  const guardado = page.waitForResponse(r => r.url().endsWith('/api/products') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar Producto' }).first().click()
  const r = await guardado
  expect(r.status()).toBe(201)
  const id = (await r.json()).product.id as number
  createdIds.push(id)

  const imgs = await imagenesDe(page, id)
  expect(imgs, 'el producto debe guardar las 2 fotos (casilla 1 y casilla 6)').toHaveLength(2)
  expect(imgs[1]).toBe(urlSexta)
  for (const u of imgs) expect(enDisco(u), `el archivo ${u} debe existir en storage`).toBe(true)
})

test('edición: subir una foto en una casilla vacía y guardar la deja en el producto', async ({ page }) => {
  await login(page)
  const creado = await page.request.post('/api/products', { data: { name: 'ZZ Foto E2E edicion', cost_per_unit_usd: 1, price_per_unit_usd: 2 } })
  expect(creado.status()).toBe(201)
  const id = (await creado.json()).product.id as number
  createdIds.push(id)

  await page.goto(`/productos/${id}/editar`)
  await expect(page.locator('input[type=file]')).toHaveCount(6)
  const url = await subirEnCasilla(page, 1, files.webp)

  const guardado = page.waitForResponse(r => r.url().includes(`/api/products/${id}`) && r.request().method() === 'PATCH')
  await page.getByRole('button', { name: /guardar/i }).first().click()
  expect((await guardado).status()).toBe(200)

  const imgs = await imagenesDe(page, id)
  expect(imgs).toEqual([url])
  expect(enDisco(url)).toBe(true)
})

test('el límite de subidas es por USUARIO: agotar el de un admin no bloquea a otro (aunque compartan IP)', async () => {
  test.setTimeout(150_000)
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer()
  const subir = async (userId: number): Promise<number> => {
    const api = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${await tokenFor(userId)}` } })
    const r = await api.post('/api/upload/image', { multipart: { type: 'product', file: { name: 'a.png', mimeType: 'image/png', buffer: png } } })
    await api.dispose()
    return r.status()
  }
  // las subidas de las pruebas anteriores ya consumieron puntos del usuario A: esperar a que se libere la ventana de 60 s
  await new Promise(r => setTimeout(r, 62_000))
  const codigosA: number[] = []
  for (let i = 0; i < 22; i++) codigosA.push(await subir(ADMIN_A))
  expect(codigosA.slice(0, 20).every(c => c === 201), 'las primeras 20 del usuario A pasan').toBe(true)
  expect(codigosA.slice(20).every(c => c === 429), 'a partir de la 21 el usuario A recibe 429').toBe(true)
  expect(await subir(ADMIN_B), 'el usuario B (misma IP) sigue pudiendo subir').toBe(201)
})
