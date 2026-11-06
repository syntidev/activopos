import { expect, test } from '@playwright/test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Vista previa al compartir por WhatsApp: og:image ABSOLUTA, tarjeta JPEG 1200×630 < 250 KB.
 * Datos propios (negocio de pruebas ZZA, prefijo "ZZA OG"); del negocio 87 (OnBike) solo se LEE.
 * Capturas en tests/__capturas__/zza-og-*.jpg (no se versionan).
 */
const UA = { 'User-Agent': 'WhatsApp/2.23.20.0 A' }
const MAX_BYTES = 250 * 1024
const { businessId: BID, slug: SLUG } = ownBusiness()
const FIXTURE = `/storage/tenants/${BID}/products/zza-og-fixture.webp`
const FIXTURE_FILE = path.join(process.cwd(), 'storage', 'tenants', String(BID), 'products', 'zza-og-fixture.webp')
const CAPTURAS = path.join(__dirname, '__capturas__')

let withPhoto = 0
let noPhoto = 0
let originalTemplate = 'generic'

function metaOf(html: string, key: string): string | null {
  const m = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))
  return m ? m[1].replace(/&amp;/g, '&') : null
}

async function checkJpeg(buf: Buffer): Promise<void> {
  expect(buf.length).toBeLessThan(MAX_BYTES)
  const m = await sharp(buf).metadata()
  expect([m.format, m.width, m.height]).toEqual(['jpeg', 1200, 630])
}

test.beforeAll(async () => {
  originalTemplate = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) || 'generic'
  mkdirSync(path.dirname(FIXTURE_FILE), { recursive: true })
  mkdirSync(CAPTURAS, { recursive: true })
  // Foto con mucho ruido (el peor caso para el peso del JPEG) y en WebP, como las de producción.
  writeFileSync(FIXTURE_FILE, await sharp({ create: { width: 1600, height: 1200, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 70 } } }).webp({ quality: 95 }).toBuffer())
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA OG%'`)
  const row = (name: string, images: string, price: number) =>
    `INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
     VALUES (${BID},'${name}','${images}',${price},'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3))`
  sql(row('ZZA OG con foto', `["${FIXTURE}"]`, 15.5))
  sql(row('ZZA OG sin foto', '[]', 8))
  withPhoto = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='ZZA OG con foto'`))
  noPhoto = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='ZZA OG sin foto'`))
})

test.afterAll(() => {
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA OG%'`)
  sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BID}`)
  rmSync(FIXTURE_FILE, { force: true })
})

test('ficha: og:image absoluta con dimensiones, og:url y tarjeta grande', async ({ request }) => {
  const res = await request.get(`/c/${SLUG}/p/${withPhoto}`, { headers: UA })
  expect(res.status()).toBe(200)
  const html = await res.text()
  const image = metaOf(html, 'og:image')
  expect(image).toMatch(new RegExp(`^https?://[^/]+/api/og/producto/${SLUG}/${withPhoto}\\?v=\\d+$`))
  expect(metaOf(html, 'og:image:width')).toBe('1200')
  expect(metaOf(html, 'og:image:height')).toBe('630')
  expect(metaOf(html, 'og:image:type')).toBe('image/jpeg')
  expect(metaOf(html, 'og:url')).toMatch(new RegExp(`^https?://[^/]+/c/${SLUG}/p/${withPhoto}$`))
  expect(metaOf(html, 'og:type')).toBe('product')
  expect(metaOf(html, 'twitter:card')).toBe('summary_large_image')
  expect(metaOf(html, 'twitter:image')).toBe(image)

  // La URL absoluta del meta es la que descarga el crawler: 200, JPEG, 1200×630, liviana, cacheable un día.
  const img = await request.get(image as string, { headers: UA })
  expect(img.status()).toBe(200)
  expect(img.headers()['content-type']).toBe('image/jpeg')
  expect(img.headers()['cache-control']).toContain('max-age=86400')
  const buf = await img.body()
  await checkJpeg(buf)
  writeFileSync(path.join(CAPTURAS, 'zza-og-generico-foto.jpg'), buf)
})

test('producto sin foto: tarjeta tipográfica con nombre y precio', async ({ request }) => {
  const res = await request.get(`/api/og/producto/${SLUG}/${noPhoto}`, { headers: UA })
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/jpeg')
  const buf = await res.body()
  await checkJpeg(buf)
  writeFileSync(path.join(CAPTURAS, 'zza-og-sin-foto.jpg'), buf)
})

test('plantilla carta: tarjeta con paleta oscura', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='carta' WHERE id=${BID}`)
  try {
    const res = await request.get(`/api/og/producto/${SLUG}/${withPhoto}`, { headers: UA })
    expect(res.status()).toBe(200)
    const buf = await res.body()
    await checkJpeg(buf)
    writeFileSync(path.join(CAPTURAS, 'zza-og-carta.jpg'), buf)
  } finally {
    sql(`UPDATE businesses SET catalog_template='${originalTemplate}' WHERE id=${BID}`)
  }
})

test('OnBike premium (solo lectura): foto real WebP → JPEG liviano', async ({ request }) => {
  const res = await request.get('/api/og/producto/onbike/1306', { headers: UA })
  expect(res.status()).toBe(200)
  const buf = await res.body()
  await checkJpeg(buf)
  writeFileSync(path.join(CAPTURAS, 'zza-og-onbike.jpg'), buf)
})

test('aislamiento: producto de otro negocio o slug inválido → 404', async ({ request }) => {
  const otro = Number(sql(`SELECT id FROM products WHERE business_id<>${BID} AND active=1 ORDER BY id LIMIT 1`))
  expect((await request.get(`/api/og/producto/${SLUG}/${otro}`, { headers: UA })).status()).toBe(404)
  expect((await request.get(`/api/og/producto/${SLUG}/abc`, { headers: UA })).status()).toBe(404)
  expect((await request.get('/api/og/producto/..%2Fetc/1', { headers: UA })).status()).toBe(404)
  expect((await request.get('/api/og/portada/no-existe-zza', { headers: UA })).status()).toBe(404)
})

test('portada: og:image absoluta y tarjeta con nombre del negocio', async ({ request }) => {
  const res = await request.get(`/c/${SLUG}`, { headers: UA })
  expect(res.status()).toBe(200)
  const html = await res.text()
  const image = metaOf(html, 'og:image')
  expect(image).toMatch(new RegExp(`^https?://[^/]+/api/og/portada/${SLUG}\\?v=\\d+$`))
  expect(metaOf(html, 'og:image:width')).toBe('1200')
  expect(metaOf(html, 'twitter:card')).toBe('summary_large_image')
  const img = await request.get(image as string, { headers: UA })
  expect(img.status()).toBe(200)
  const buf = await img.body()
  await checkJpeg(buf)
  writeFileSync(path.join(CAPTURAS, 'zza-og-portada.jpg'), buf)
})
