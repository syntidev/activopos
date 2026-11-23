import { test, expect, type APIRequestContext } from '@playwright/test'
import { SignJWT } from 'jose'
import path from 'path'
import { envValue, sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * SEO y Analítica por negocio: title/description/canonical, GA4, Search Console, JSON-LD (Store, CafeOrCoffeeShop, Product),
 * sitemap.xml y robots.txt por host. Negocio de pruebas propio (ZZA); el 217 (ZZB) solo se LEE.
 * Correr con el dev server en :3001 y el dominio propio simulado:
 *   CUSTOM_DOMAINS="premium.zza.test=zza-pruebas:premium,carta.zza.test=zza-pruebas:carta" E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const { businessId: BID, adminId: ADMIN, slug: SLUG } = ownBusiness()
const DOMINIO = 'premium.zza.test'
const SEO = {
  seo_title: 'ZZA SEO Titulo de prueba',
  // "</script>" en un texto del negocio: no puede cerrar el bloque JSON-LD
  seo_description: 'Ofertas </script><script>alert(1)</script> de ZZA',
  ga4_id: 'G-ZZA12345AB',
  gsc_verification: 'zzaSearchConsoleToken_0123456789abcdef',
}
const NOMBRE_VISIBLE = 'ZZA Seo </script> Visible'
const NOMBRE_AGOTADO = 'ZZA Seo Agotado'
const NOMBRE_OCULTO = 'ZZA Seo Oculto'
const CATEGORIA = 'ZZA Seo Cat'

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let plantilla = ''
let plan = ''
let api: APIRequestContext
const ids: { visible: number; agotado: number; oculto: number } = { visible: 0, agotado: 0, oculto: 0 }

const patch = (data: object) => api.patch('/api/config/seo-analitica', { data })
const jsonLd = (html: string): Array<Record<string, unknown>> =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]) as Record<string, unknown>)
const tag = (html: string, parts: string[]): string | undefined => (html.match(/<(?:link|meta)\b[^>]*>/g) ?? []).find(t => parts.every(p => t.includes(p)))
const title = (html: string): string => /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? ''

async function page(request: APIRequestContext, ruta: string, host?: string): Promise<string> {
  const res = await request.get(ruta, { headers: host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {} })
  expect(res.status(), ruta).toBe(200)
  return res.text()
}

function insertProduct(name: string, extraCols: string, extraVals: string): number {
  const n = name.replace(/'/g, "''")
  sql(`INSERT INTO products (business_id,name,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at${extraCols})
       VALUES (${BID},'${n}','[]',12,'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3)${extraVals})`)
  return Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='${n}'`))
}

function limpiar(): void {
  sql(`UPDATE businesses SET settings=JSON_REMOVE(settings,'$.seo_title','$.seo_description','$.ga4_id','$.gsc_verification') WHERE id=${BID} AND settings IS NOT NULL`)
  sql(`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Seo%')`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Seo%'`)
  sql(`DELETE FROM categories WHERE business_id=${BID} AND name='${CATEGORIA}'`)
}

test.beforeAll(async ({ playwright }) => {
  plantilla = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`)
  plan = sql(`SELECT catalog_plan FROM businesses WHERE id=${BID}`)
  limpiar()
  sql(`INSERT INTO categories (business_id,name) VALUES (${BID},'${CATEGORIA}')`)
  const cat = Number(sql(`SELECT id FROM categories WHERE business_id=${BID} AND name='${CATEGORIA}'`))
  ids.visible = insertProduct(NOMBRE_VISIBLE, ',category_id,has_variants', `,${cat},1`)
  sql(`INSERT INTO product_variants (product_id,tipo,valor,stock,is_active) VALUES (${ids.visible},'talla','M',5,1)`)
  ids.agotado = insertProduct(NOMBRE_AGOTADO, '', '')
  ids.oculto = insertProduct(NOMBRE_OCULTO, '', '')
  sql(`UPDATE products SET catalog_visibility='hidden' WHERE id=${ids.oculto}`)
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  api = await playwright.request.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `activopos_session=${token}` } })
})

test.afterAll(async () => {
  await api.dispose()
  limpiar()
  sql(`UPDATE businesses SET catalog_template='${plantilla}', catalog_plan='${plan}' WHERE id=${BID}`)
})

test('sin configurar: el catálogo se comporta como hoy (sin GA4, sin verificación, título del catálogo)', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const html = await page(request, `/catalogo-premium/${SLUG}`)
  expect(html).not.toContain('googletagmanager.com')
  expect(html).not.toContain('google-site-verification')
  expect(title(html)).toContain('— Catálogo')
  expect(title(html)).not.toContain('ZZA SEO')
  expect(jsonLd(html)[0]?.['@type']).toBe('Store') // el JSON-LD de portada no depende de la configuración SEO
})

test('valida en el servidor: ga4_id, gsc_verification, largos y plan sin catálogo', async () => {
  for (const bad of ['G-<script>alert(1)</script>', 'g-abc12345', 'G-123', 'G-ABCDEFGHIJKLM', 'UA-12345-1', "G-AB12CD34'); alert(1);//"]) {
    const res = await patch({ ga4_id: bad })
    expect(res.status(), bad).toBe(400)
  }
  expect((await patch({ gsc_verification: '"><script>alert(1)</script>' })).status()).toBe(400)
  expect((await patch({ gsc_verification: 'corto' })).status()).toBe(400)
  expect((await patch({ seo_title: 'x'.repeat(61) })).status()).toBe(400)
  expect((await patch({ seo_description: 'x'.repeat(161) })).status()).toBe(400)
  expect((await patch({ ga4_id: 'G-ZZA12345AB', intruso: 'x' })).status()).toBe(400) // strictObject: sin campos extra
  expect((await patch({})).status()).toBe(400)
  expect(sql(`SELECT JSON_EXTRACT(settings,'$.ga4_id') FROM businesses WHERE id=${BID}`)).toBe('NULL')

  sql(`UPDATE businesses SET catalog_plan='gratis' WHERE id=${BID}`)
  expect((await patch(SEO)).status()).toBe(403)
  sql(`UPDATE businesses SET catalog_plan='${plan}' WHERE id=${BID}`)
})

test('guarda y se ve en la portada de cada plantilla: title, description, canonical, GA4, Search Console y JSON-LD', async ({ request }) => {
  const res = await patch(SEO)
  expect(res.status(), await res.text()).toBe(200)
  expect((await (await api.get('/api/config/seo-analitica')).json() as { seo: typeof SEO }).seo).toEqual(SEO)

  for (const [tpl, ruta, tipo] of [
    ['premium', `/catalogo-premium/${SLUG}`, 'Store'],
    ['generic', `/catalogo/${SLUG}`, 'Store'],
    ['carta', `/catalogo-carta/${SLUG}`, 'CafeOrCoffeeShop'],
  ] as const) {
    sql(`UPDATE businesses SET catalog_template='${tpl}' WHERE id=${BID}`)
    const html = await page(request, ruta)
    expect(title(html), tpl).toContain(SEO.seo_title)
    expect(tag(html, ['name="description"'])).toContain('Ofertas &lt;/script&gt;') // atributo escapado por React
    // canonical: ZZA tiene dominio propio → siempre apunta ahí, aunque se entre por activopos.com/c/<slug>
    expect(tag(html, ['rel="canonical"']), tpl).toContain(`href="https://${DOMINIO}"`) // Next quita la "/" final de la raíz
    expect(html, tpl).toContain(`googletagmanager.com/gtag/js?id=${SEO.ga4_id}`)
    // next/script (afterInteractive) lleva el init en el payload de hidratación: las comillas salen escapadas
    expect(html, tpl).toContain('ga4-init')
    expect(html, tpl).toMatch(new RegExp(`gtag\\('config',(?:\\\\)*"${SEO.ga4_id}`))
    expect(tag(html, ['name="google-site-verification"', SEO.gsc_verification]), tpl).toBeTruthy()

    const store = jsonLd(html).find(d => d['@type'] === tipo)
    expect(store, `${tpl} JSON-LD ${tipo}`).toBeTruthy()
    expect(store!.name).toBe(sql(`SELECT name FROM businesses WHERE id=${BID}`))
    expect(store!.description).toBe(SEO.seo_description) // el JSON se decodifica y trae el texto original
    expect(store!.url).toBe(`https://${DOMINIO}/`)
    expect(html, `${tpl} el texto no cierra el <script> del JSON-LD`).not.toContain('</script><script>alert(1)')
  }
})

test('ficha: Product con precio USD y disponibilidad real; el nombre con "</script>" no rompe el JSON-LD', async ({ request }) => {
  for (const [tpl, base] of [['premium', '/catalogo-premium'], ['generic', '/catalogo']] as const) {
    sql(`UPDATE businesses SET catalog_template='${tpl}' WHERE id=${BID}`)
    const visible = await page(request, `${base}/${SLUG}/p/${ids.visible}`)
    const p = jsonLd(visible).find(d => d['@type'] === 'Product')
    expect(p, `${tpl} Product`).toBeTruthy()
    expect(p!.name).toBe(NOMBRE_VISIBLE)
    const offer = p!.offers as Record<string, unknown>
    expect([offer.price, offer.priceCurrency, offer.availability]).toEqual(['12.00', 'USD', 'https://schema.org/InStock'])
    expect(offer.url).toBe(`https://${DOMINIO}/p/${ids.visible}`)
    expect(tag(visible, ['rel="canonical"'])).toContain(`href="https://${DOMINIO}/p/${ids.visible}"`)
    expect(p!).not.toHaveProperty('image') // sin imagen: el campo se omite, no se inventa

    const agotado = await page(request, `${base}/${SLUG}/p/${ids.agotado}`)
    const out = jsonLd(agotado).find(d => d['@type'] === 'Product')!.offers as Record<string, unknown>
    expect(out.availability, tpl).toBe('https://schema.org/OutOfStock')
  }
})

test('dominio propio: título sin "| ActivoPOS" y canonical limpio; en activopos.com el sufijo se mantiene', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const dom = await page(request, '/', DOMINIO)
  expect(title(dom)).toBe(SEO.seo_title)
  expect(tag(dom, ['rel="canonical"'])).toContain(`href="https://${DOMINIO}"`)
  expect(tag(dom, ['property="og:url"'])).toContain(`content="https://${DOMINIO}"`)
  const dir = await page(request, `/catalogo-premium/${SLUG}`)
  expect(title(dir)).toBe(`${SEO.seo_title} | ActivoPOS`)
})

test('sitemap.xml y robots.txt: por dominio (sin ocultos) y por activopos.com/c/<slug>', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const sm = await page(request, '/sitemap.xml', DOMINIO)
  for (const u of [`https://${DOMINIO}/`, `https://${DOMINIO}/tienda`, `https://${DOMINIO}/p/${ids.visible}`, `https://${DOMINIO}/p/${ids.agotado}`,
    `https://${DOMINIO}/tienda?categoria=${encodeURIComponent(CATEGORIA)}`, `https://${DOMINIO}/privacidad`, `https://${DOMINIO}/terminos`]) {
    expect(sm, u).toContain(`<loc>${u}</loc>`)
  }
  expect(sm, 'el producto oculto no entra').not.toContain(`/p/${ids.oculto}<`)
  expect(sm).not.toContain('activopos.com')
  const rb = await page(request, '/robots.txt', DOMINIO)
  expect(rb).toContain(`Sitemap: https://${DOMINIO}/sitemap.xml`)
  expect(rb).toContain('Allow: /')

  // ZZA tiene dominio propio: su /c/<slug>/sitemap.xml redirige al del dominio (no se indexa por activopos.com)
  const red = await request.get(`/c/${SLUG}/sitemap.xml`, { maxRedirects: 0 })
  expect([red.status(), red.headers()['location']]).toEqual([308, `https://${DOMINIO}/sitemap.xml`])

  // ZZB (solo lectura) no tiene dominio: sitemap y robots propios en /c/<slug>
  const b = await request.get('/c/zzb-pruebas/sitemap.xml')
  expect(b.status()).toBe(200)
  expect(b.headers()['content-type']).toContain('xml')
  const xml = await b.text()
  expect(xml).toContain(`<loc>${BASE}/c/zzb-pruebas</loc>`)
  expect(xml).toContain(`<loc>${BASE}/c/zzb-pruebas/privacidad</loc>`)
  expect(xml).toMatch(new RegExp(`<loc>${BASE}/c/zzb-pruebas/p/\\d+</loc>`))
  const brb = await (await request.get('/c/zzb-pruebas/robots.txt')).text()
  expect(brb).toContain(`Sitemap: ${BASE}/c/zzb-pruebas/sitemap.xml`)
  expect(brb).toContain('Allow: /')
  expect((await request.get('/c/slug-que-no-existe-zz/sitemap.xml')).status()).toBe(404)

  // robots global de activopos.com: lista el sitemap de los catálogos SIN dominio propio
  const global = await (await request.get('/robots.txt')).text()
  expect(global).toContain('c/zzb-pruebas/sitemap.xml')
  expect(global).not.toContain(`c/${SLUG}/sitemap.xml`)
})

test('panel: Configuración > SEO y Analítica con contadores; un ID de GA4 inválido se marca y no se guarda', async ({ page: p }) => {
  const token = await new SignJWT({ userId: ADMIN, businessId: BID, role: 'admin', name: 'Admin ZZA' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await p.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
  await p.setViewportSize({ width: 1280, height: 900 })
  await p.goto('/configuracion')
  await p.getByRole('button', { name: 'SEO y Analítica' }).first().click()
  const panel = p.getByTestId('seo-analitica')
  await expect(panel.locator('#seo-title')).toHaveValue(SEO.seo_title, { timeout: 30_000 })
  await expect(panel.getByTestId('seo-title-contador')).toHaveText(`${SEO.seo_title.length}/60`)
  await expect(panel.getByTestId('seo-description-contador')).toHaveText(`${SEO.seo_description.length}/160`)
  await panel.locator('#seo-ga4').fill('G-mal')
  await expect(panel.getByText(/Debe verse como G-XXXXXXXXXX/)).toBeVisible()
  await panel.getByRole('button', { name: 'Guardar' }).click()
  expect(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(settings,'$.ga4_id')) FROM businesses WHERE id=${BID}`)).toBe(SEO.ga4_id) // no se pisó
  await panel.locator('#seo-ga4').fill(SEO.ga4_id)
  await p.screenshot({ path: path.join(process.cwd(), '.doc', 'seo-analitica-panel-1280.png'), fullPage: true })
})

test('borrar los campos devuelve el catálogo a su comportamiento anterior', async ({ request }) => {
  const res = await patch({ seo_title: '', seo_description: '', ga4_id: '', gsc_verification: '' })
  expect(res.status(), await res.text()).toBe(200)
  expect(sql(`SELECT JSON_EXTRACT(settings,'$.ga4_id') FROM businesses WHERE id=${BID}`)).toBe('NULL')
  sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  const html = await page(request, `/catalogo-premium/${SLUG}`)
  expect(html).not.toContain('googletagmanager.com')
  expect(html).not.toContain('google-site-verification')
  expect(title(html)).toContain('— Catálogo')
})
