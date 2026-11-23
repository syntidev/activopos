import { test, expect, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import sharp from 'sharp'
import { readFileSync, readdirSync, rmSync } from 'fs'
import path from 'path'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Identidad web por negocio: favicon e imagen para compartir propios en TODOS los catálogos (genérico, premium, carta, legales,
 * dominio propio simulado). Negocio de pruebas propio (ZZA). Correr con el dev server en :3001 y el dominio propio simulado:
 *   CUSTOM_DOMAINS="premium.zza.test=zza-pruebas:premium" E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN, slug: SLUG } = ownBusiness()
const DOMINIO = 'premium.zza.test'
const BRAND_DIR = path.join(process.cwd(), 'storage', 'tenants', String(BID), 'brand')
const PAGINAS = [
  ['generic', `/catalogo/${SLUG}`],
  ['premium', `/catalogo-premium/${SLUG}`],
  ['premium', `/catalogo-premium/${SLUG}/privacidad`],
  ['carta', `/catalogo-carta/${SLUG}`],
] as const

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let plantilla = ''
let plan = ''
let api: APIRequestContext

const png = (w: number, h = w): Promise<Buffer> =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#d62828' } }).png().toBuffer()
/** Imagen verde con una franja amarilla de 200 px a la izquierda (para comprobar el punto de enfoque). */
const jpg = (w: number, h: number): Promise<Buffer> =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#2a9d8f' } })
    .composite([{ input: { create: { width: 200, height: h, channels: 3, background: '#e9c46a' } }, left: 0, top: 0 }]).jpeg().toBuffer()

const upload = (kind: 'favicon' | 'og', name: string, mimeType: string, buffer: Buffer, extra: Record<string, string> = {}) =>
  api.post('/api/config/identidad-web', { multipart: { kind, file: { name, mimeType, buffer }, ...extra } })

async function head(request: APIRequestContext, ruta: string, host?: string): Promise<string> {
  const res = await request.get(ruta, { headers: host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {} })
  expect(res.status(), ruta).toBe(200)
  const html = await res.text()
  return html.slice(html.indexOf('<head'), html.indexOf('</head>'))
}
/** Todas las etiquetas <link>/<meta> del head, para buscar atributos sin depender del orden. */
const tags = (h: string): string[] => h.match(/<(?:link|meta)\b[^>]*>/g) ?? []
const tag = (h: string, parts: string[]): string | undefined => tags(h).find(t => parts.every(p => t.includes(p)))
const setting = (key: string): string => sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.${key}')) FROM businesses WHERE id=${BID}`)
const file = (rutaWeb: string): Buffer => readFileSync(path.join(process.cwd(), rutaWeb.replace(/^\//, '')))

function limpiar(): void {
  sql(`UPDATE businesses SET settings=JSON_REMOVE(settings,'$.web_favicon','$.web_og_image') WHERE id=${BID} AND settings IS NOT NULL`)
  try { for (const f of readdirSync(BRAND_DIR)) if (f.startsWith('web-')) rmSync(path.join(BRAND_DIR, f), { force: true }) } catch { /* carpeta inexistente */ }
}

test.beforeAll(async ({ playwright }) => {
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`)
  plan = sql(`SELECT catalog_plan FROM businesses WHERE id=${BID}`)
  limpiar()
  sql(`DELETE FROM products WHERE business_id=${BID} AND name='ZZA Identidad Producto'`)
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BID},'ZZA Identidad Producto','[]',10,'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3))`)
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  api = await playwright.request.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${token}` } })
})

test.afterAll(async () => {
  await api.dispose()
  limpiar()
  sql(`DELETE FROM products WHERE business_id=${BID} AND name='ZZA Identidad Producto'`)
  sql(`UPDATE businesses SET catalog_template='${plantilla}', catalog_plan='${plan}' WHERE id=${BID}`)
})

test('sin identidad propia: cada catálogo trae el favicon de ActivoPOS y la og:image generada', async ({ request }) => {
  for (const [tpl, ruta] of PAGINAS) {
    sql(`UPDATE businesses SET catalog_template='${tpl}' WHERE id=${BID}`)
    const h = await head(request, ruta)
    expect(h, ruta).not.toContain('web-favicon')
    expect(h, ruta).not.toContain('/api/web/manifest')
    expect(tag(h, ['rel="icon"', '/favicon.ico']), ruta).toBeTruthy()
    expect(tag(h, ['og:image', `/api/og/portada/${SLUG}`]), ruta).toBeTruthy()
  }
})

test('valida: favicon no cuadrado, muy chico, SVG con scripts, archivo falso, OG chico y plan sin catálogo', async () => {
  const noCuadrado = await upload('favicon', 'a.png', 'image/png', await png(800, 600))
  expect(noCuadrado.status()).toBe(400)
  expect((await noCuadrado.json()).error).toMatch(/cuadrado/)
  expect((await upload('favicon', 'b.png', 'image/png', await png(300))).status()).toBe(400)
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><script>alert(1)</script><rect width="600" height="600"/></svg>')
  const malo = await upload('favicon', 'c.svg', 'image/svg+xml', svg)
  expect(malo.status()).toBe(400)
  expect((await malo.json()).error).toMatch(/SVG/)
  expect((await upload('favicon', 'd.png', 'image/png', Buffer.from('no soy una imagen'))).status()).toBe(400)
  expect((await upload('og', 'e.jpg', 'image/jpeg', await jpg(400, 200))).status()).toBe(400)

  sql(`UPDATE businesses SET catalog_plan='gratis' WHERE id=${BID}`)
  expect((await upload('favicon', 'f.png', 'image/png', await png(600))).status()).toBe(403)
  sql(`UPDATE businesses SET catalog_plan='${plan}' WHERE id=${BID}`)
  expect(setting('web_favicon')).toBe('NULL')
})

test('sube favicon (SVG válido) e imagen para compartir: se guardan los tamaños y el recorte 1200×630', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#d62828"/></svg>')
  const fav = await upload('favicon', 'ok.svg', 'image/svg+xml', svg)
  expect(fav.status(), await fav.text()).toBe(201)
  const base = setting('web_favicon')
  expect(base).toMatch(new RegExp(`^/storage/tenants/${BID}/brand/web-favicon-\\d+$`))
  for (const s of [32, 180, 192, 512]) {
    const m = await sharp(file(`${base}-${s}.png`)).metadata()
    expect([m.format, m.width, m.height], `${s}`).toEqual(['png', s, s])
  }

  // 1000×1000 con la franja amarilla a la izquierda: enfoque 0/0 → la franja queda en el borde izquierdo del recorte
  const og = await upload('og', 'og.jpg', 'image/jpeg', await jpg(1000, 1000), { focus_x: '0', focus_y: '0' })
  expect(og.status(), await og.text()).toBe(201)
  const ogBase = setting('web_og_image')
  for (const ext of ['jpg', 'webp'] as const) {
    const m = await sharp(file(`${ogBase}.${ext}`)).metadata()
    expect([m.format === 'jpeg' ? 'jpg' : m.format, m.width, m.height]).toEqual([ext, 1200, 630])
  }
  const { data } = await sharp(file(`${ogBase}.jpg`)).raw().toBuffer({ resolveWithObject: true })
  expect(data[0], 'rojo de la franja (233,196,106)').toBeGreaterThan(200)
  expect(data[2], 'azul de la franja').toBeLessThan(160)
})

test('con identidad propia: icon, apple-touch, manifest, theme-color y og:image del negocio en cada catálogo', async ({ request }) => {
  const base = setting('web_favicon')
  const accent = sql(`SELECT theme_color FROM businesses WHERE id=${BID}`)
  for (const [tpl, ruta] of PAGINAS) {
    sql(`UPDATE businesses SET catalog_template='${tpl}' WHERE id=${BID}`)
    const h = await head(request, ruta)
    expect(tag(h, ['rel="icon"', `${base}-32.png`]), `${ruta} icon 32`).toBeTruthy()
    expect(tag(h, ['rel="icon"', `${base}-192.png`]), `${ruta} icon 192`).toBeTruthy()
    expect(tag(h, ['rel="apple-touch-icon"', `${base}-180.png`]), `${ruta} apple`).toBeTruthy()
    expect(tag(h, ['rel="manifest"', `/api/web/manifest/${SLUG}`]), `${ruta} manifest`).toBeTruthy()
    expect(h, `${ruta} sin el favicon de ActivoPOS`).not.toContain('/favicon-96x96.png')
    const tc = tag(h, ['name="theme-color"'])
    expect(tc, `${ruta} theme-color`).toBeTruthy()
    if (tpl !== 'carta') expect(tc!.toLowerCase()).toContain(accent.toLowerCase())
    // og:image: absoluta, 1200×630 y tipo jpeg (la ruta de portada sirve el archivo subido)
    expect(tag(h, ['property="og:image"', `/api/og/portada/${SLUG}`]), `${ruta} og:image`).toMatch(/content="https?:\/\/[^"]+\/api\/og\/portada\//)
    expect(tag(h, ['og:image:width', '1200'])).toBeTruthy()
    expect(tag(h, ['og:image:height', '630'])).toBeTruthy()
    expect(tag(h, ['og:image:type', 'image/jpeg'])).toBeTruthy()
  }
  // la portada sirve el jpg subido (no la tarjeta generada)
  const res = await request.get(`/api/og/portada/${SLUG}`)
  expect(res.headers()['content-type']).toBe('image/jpeg')
  expect(Buffer.compare(await res.body(), file(`${setting('web_og_image')}.jpg`))).toBe(0)

  const manifest = await request.get(`/api/web/manifest/${SLUG}`)
  expect(manifest.status()).toBe(200)
  const m = await manifest.json() as { name: string; start_url: string; icons: Array<{ src: string; sizes: string }> }
  expect(m.name).toBe(sql(`SELECT name FROM businesses WHERE id=${BID}`))
  expect(m.icons.map(i => i.sizes)).toEqual(['192x192', '512x512'])
  expect(m.icons[0].src).toBe(`${base}-192.png`)
  expect(m.start_url).toBe(`/c/${SLUG}`)
})

test('las fichas de producto siguen con la imagen del producto (no la portada del negocio)', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const id = sql(`SELECT id FROM products WHERE business_id=${BID} AND name='ZZA Identidad Producto'`)
  const h = await head(request, `/catalogo-premium/${SLUG}/p/${id}`)
  expect(tag(h, ['property="og:image"'])).toContain('/api/og/producto/')
  expect(tag(h, ['rel="icon"', 'web-favicon'])).toBeTruthy() // el favicon sí es del negocio
})

test('dominio propio simulado: og:image con el host del dominio y manifest en "/"', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const base = setting('web_favicon')
  const h = await head(request, '/', DOMINIO)
  expect(tag(h, ['rel="icon"', `${base}-32.png`])).toBeTruthy()
  expect(tag(h, ['rel="apple-touch-icon"', `${base}-180.png`])).toBeTruthy()
  expect(tag(h, ['property="og:image"'])).toContain(`content="https://${DOMINIO}/api/og/portada/${SLUG}`)
  const m = await request.get(`/api/web/manifest/${SLUG}`, { headers: { 'x-forwarded-host': DOMINIO, 'x-forwarded-proto': 'https' } })
  expect((await m.json() as { start_url: string }).start_url).toBe('/')
})

test('panel: Configuración > Identidad web muestra lo subido y permite elegir una imagen nueva con enfoque', async ({ page }) => {
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Identidad web' }).first().click()
  const panel = page.getByTestId('identidad-web')
  await expect(panel.getByTestId('identidad-favicon-actual')).toBeVisible({ timeout: 30_000 }) // 1ª carga: next dev compila la ruta
  await expect(panel.getByTestId('identidad-og-actual')).toBeVisible()
  await panel.getByTestId('identidad-og-input').setInputFiles({ name: 'nueva.jpg', mimeType: 'image/jpeg', buffer: await jpg(1600, 900) })
  await expect(panel.getByTestId('identidad-og-enfoque')).toBeVisible()
  await panel.getByTestId('identidad-og-enfoque').click({ position: { x: 5, y: 5 } })
  await expect(panel.getByText(/Enfoque: \d+% · \d+%/)).toBeVisible()
  await page.screenshot({ path: path.join(process.cwd(), '.doc', 'identidad-web-panel-1280.png'), fullPage: true })
})

test('quitar la identidad devuelve los de ActivoPOS y borra los archivos', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  expect((await api.delete('/api/config/identidad-web?kind=favicon')).status()).toBe(200)
  expect((await api.delete('/api/config/identidad-web?kind=og')).status()).toBe(200)
  expect(setting('web_favicon')).toBe('NULL')
  expect(readdirSync(BRAND_DIR).filter(f => f.startsWith('web-'))).toEqual([])
  const h = await head(request, `/catalogo-premium/${SLUG}`)
  expect(h).not.toContain('web-favicon')
  expect(tag(h, ['rel="icon"', '/favicon.ico'])).toBeTruthy()
  expect((await request.get(`/api/web/manifest/${SLUG}`)).status()).toBe(404)
})
