import { test, expect, type APIRequestContext } from '@playwright/test'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'

/**
 * Dominios propios (CUSTOM_DOMAINS) con cabecera Host simulada (x-forwarded-host) contra `next dev` en :3001. Arranque:
 *   CUSTOM_DOMAINS="onbikemargarita.com=onbike:premium,cafeconbike.com=cafeconbike:carta,premium.zza.test=zza-pruebas:premium,carta.zza.test=zza-pruebas:carta"
 *   (+ CUSTOM_DOMAINS_REDIRECT=on y CD_FLAG=on en el spec para el grupo "bandera encendida").
 * Datos propios: negocio de pruebas ZZA (plantilla premium/carta según el grupo); OnBike y activopos.com solo se LEEN.
 */
const { businessId: BID, slug: SLUG } = ownBusiness()
const PREMIUM = 'premium.zza.test'
const CARTA = 'carta.zza.test'
const FLAG_ON = process.env.CD_FLAG === 'on'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

let productId = 0
let original = ''

/** Enlaces con la ruta de siempre que NO deberían salir en un dominio propio. */
const viejos = (html: string): string[] => html.match(new RegExp('href="/catalogo-(?:premium|carta)[^"]*"', 'g')) ?? []

async function get(request: APIRequestContext, host: string | null, path: string): Promise<{ status: number; location: string | null; text: string; type: string }> {
  const res = await request.get(path, { maxRedirects: 0, headers: host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {} })
  return { status: res.status(), location: res.headers()['location'] ?? null, text: await res.text(), type: res.headers()['content-type'] ?? '' }
}

test.beforeAll(() => {
  original = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`)
  sql(`UPDATE businesses SET catalog_template='premium', settings=JSON_SET(COALESCE(settings,JSON_OBJECT()),'$.garmin_guide',true) WHERE id=${BID}`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Dominio%'`)
  sql(`DELETE FROM brands WHERE business_id=${BID} AND name='ZZA Marca'`)
  sql(`INSERT INTO brands (business_id,name,search_term,visible) VALUES (${BID},'ZZA Marca','zza',1)`)
  const brand = Number(sql(`SELECT id FROM brands WHERE business_id=${BID} AND name='ZZA Marca'`))
  sql(`INSERT INTO products (business_id,name,brand_id,images,price_per_unit_usd,sale_mode,product_type,active,available_in_pos,show_in_catalog,catalog_visibility,is_available,availability,updated_at)
       VALUES (${BID},'ZZA Dominio Producto',${brand},'[]',10,'unit','simple',1,1,1,'visible',1,'in_stock',NOW(3))`)
  productId = Number(sql(`SELECT id FROM products WHERE business_id=${BID} AND name='ZZA Dominio Producto'`))
})

test.afterAll(() => {
  sql(`UPDATE businesses SET catalog_template='${original}', settings=JSON_REMOVE(settings,'$.garmin_guide') WHERE id=${BID}`)
  sql(`DELETE FROM products WHERE business_id=${BID} AND name LIKE 'ZZA Dominio%'`)
  sql(`DELETE FROM brands WHERE business_id=${BID} AND name='ZZA Marca'`)
})

test.describe('bandera apagada (por defecto)', () => {
  test.skip(FLAG_ON, 'este grupo corre con CUSTOM_DOMAINS_REDIRECT apagada')

  test('premium: cada ruta del mapa da 200 con el contenido del tenant', async ({ request }) => {
    // /200k reescribe a /kit-200k (landing de OnBike, que depende de su configuración): debe responder igual que la ruta directa.
    expect((await get(request, PREMIUM, '/200k')).status).toBe((await get(request, null, '/kit-200k')).status)
    for (const p of ['/', '/tienda', '/tienda?buscar=zza', `/p/${productId}`, '/tienda/marca/zza-marca', '/guia/garmin']) {
      const r = await get(request, PREMIUM, p)
      expect(r.status, `${p}`).toBe(200)
      expect(r.type, p).toContain('text/html')
    }
    expect((await get(request, PREMIUM, '/')).text).toContain('ZZ A Pruebas')
    expect((await get(request, PREMIUM, `/p/${productId}`)).text).toContain('ZZA Dominio Producto')
  })

  test('www → 301 al dominio sin www (host del mapa) con la misma ruta y query', async ({ request }) => {
    const r = await get(request, `www.${PREMIUM}`, `/tienda?buscar=x`)
    expect([r.status, r.location]).toEqual([301, `https://${PREMIUM}/tienda?buscar=x`])
  })

  test('panel en dominio propio → 301 a activopos.com con la misma ruta', async ({ request }) => {
    for (const p of ['/escritorio', '/login', '/pos', '/configuracion/tienda', '/admin']) {
      const r = await get(request, PREMIUM, p)
      expect([r.status, r.location], p).toEqual([301, `https://activopos.com${p}`])
    }
  })

  test('fuera del mapa → 404; el tenant sale del mapa, nunca de la URL', async ({ request }) => {
    for (const p of ['/inexistente', '/tienda/otra', `/p/abc`, '/c/onbike', '/catalogo-premium/onbike', '/catalogo-premium/onbike/p/1', '/tienda/marca/..%2Fx']) {
      expect((await get(request, PREMIUM, p)).status, p).toBe(404)
    }
    // Rutas nativas del PROPIO tenant: 301 a la limpia (los enlaces viejos siguen funcionando).
    const nativa = await get(request, PREMIUM, `/catalogo-premium/${SLUG}/p/${productId}?x=1`)
    expect([nativa.status, nativa.location]).toEqual([301, `https://${PREMIUM}/p/${productId}?x=1`])
    const c = await get(request, PREMIUM, `/c/${SLUG}/productos`)
    expect([c.status, c.location]).toEqual([301, `https://${PREMIUM}/tienda`])
  })

  test('host no listado: no se refleja; el comportamiento de siempre', async ({ request }) => {
    for (const h of ['evil.com', `${PREMIUM}.evil.com`, 'www.evil.com']) {
      const r = await get(request, h, `/c/${SLUG}`)
      expect(r.status, h).toBe(307)
      expect(r.location ?? '', h).not.toContain('evil.com')
    }
  })

  test('enlaces limpios en la página (logo, Inicio, Tienda, fichas, guía) y canonical/og con el dominio propio', async ({ request }) => {
    const home = (await get(request, PREMIUM, '/')).text
    expect(viejos(home)).toEqual([])
    for (const h of ['href="/"', 'href="/tienda"']) expect(home, h).toContain(h)
    const ficha = (await get(request, PREMIUM, `/p/${productId}`)).text
    expect(viejos(ficha)).toEqual([])
    expect(ficha).toContain(`<link rel="canonical" href="https://${PREMIUM}/p/${productId}"`)
    expect(ficha).toContain(`property="og:url" content="https://${PREMIUM}/p/${productId}"`)
    expect(ficha).toContain(`property="og:image" content="https://${PREMIUM}/api/og/producto/${SLUG}/${productId}?v=`)
    const guia = (await get(request, PREMIUM, '/guia/garmin')).text
    expect(viejos(guia)).toEqual([])
    const tienda = (await get(request, PREMIUM, '/tienda')).text
    expect(tienda).toContain('href="/tienda"')
    expect(viejos(tienda)).toEqual([])
  })

  test('navegador: ficha, logo y Tienda usan rutas limpias en el dominio propio', async ({ browser }) => {
    // OnBike real (solo lectura): su listado trae fichas; el negocio de prueba no tiene stock y no sale en la tienda.
    const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001', extraHTTPHeaders: { 'x-forwarded-host': 'onbikemargarita.com', 'x-forwarded-proto': 'https' } })
    const page = await ctx.newPage()
    await page.goto('/tienda')
    await expect(page.getByText('Catálogo de Productos')).toBeVisible()
    expect(await page.locator('a[href^="/catalogo-premium"]').count()).toBe(0)
    // La tarjeta navega con router.push(href): con el dominio propio el destino es /p/:id, no /catalogo-premium/<slug>/p/:id.
    await page.getByText(/^ZZ Prueba/).first().click()
    await expect(page).toHaveURL(/\/p\/\d+$/)
    await page.getByRole('link', { name: /Ir al inicio de/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.locator('header nav').getByRole('link', { name: 'Tienda' }).click()
    await expect(page).toHaveURL(/\/tienda$/)
    await ctx.close()
  })

  test('sitemap.xml y robots.txt por dominio: solo las rutas públicas del tenant', async ({ request }) => {
    const sm = (await get(request, PREMIUM, '/sitemap.xml')).text
    for (const u of [`https://${PREMIUM}/`, `https://${PREMIUM}/tienda`, `https://${PREMIUM}/p/${productId}`, `https://${PREMIUM}/guia/garmin`]) expect(sm, u).toContain(`<loc>${u}</loc>`)
    expect(sm).not.toContain('activopos.com')
    const rb = (await get(request, PREMIUM, '/robots.txt')).text
    expect(rb).toContain(`Sitemap: https://${PREMIUM}/sitemap.xml`)
    expect(rb).not.toContain('activopos.com')
  })

  test('carta: / y /p/:id dan 200 con sus enlaces limpios; /tienda y el resto → 404', async ({ request }) => {
    sql(`UPDATE businesses SET catalog_template='carta' WHERE id=${BID}`)
    const home = await get(request, CARTA, '/')
    expect(home.status).toBe(200)
    expect(viejos(home.text)).toEqual([])
    expect((await get(request, CARTA, `/p/${productId}`)).status).toBe(200)
    for (const p of ['/tienda', '/guia/garmin', '/200k', '/tienda/marca/zza-marca']) expect((await get(request, CARTA, p)).status, p).toBe(404)
    const ficha = (await get(request, CARTA, `/p/${productId}`)).text
    expect(ficha).toContain(`<link rel="canonical" href="https://${CARTA}/p/${productId}"`)
    sql(`UPDATE businesses SET catalog_template='premium' WHERE id=${BID}`)
  })

  test('OnBike real (solo lectura) y activopos.com sin cambios', async ({ request }) => {
    expect((await get(request, 'onbikemargarita.com', '/')).status).toBe(200)
    expect((await get(request, 'onbikemargarita.com', '/tienda')).status).toBe(200)
    expect((await get(request, null, '/catalogo-premium/onbike')).status).toBe(200) // activopos.com / localhost: igual que siempre
    expect((await get(request, null, '/c/onbike')).status).toBe(307)
    const panel = await get(request, null, '/escritorio')
    expect([panel.status, panel.location ?? '']).toEqual([307, expect.stringContaining('/login')])
    expect((await get(request, null, '/')).status).toBe(200) // marketing
  })
})

test.describe('bandera encendida', () => {
  test.skip(!FLAG_ON, 'este grupo corre con CUSTOM_DOMAINS_REDIRECT=on')

  test('en activopos.com las rutas viejas → 301 al dominio propio con su ruta equivalente', async ({ request }) => {
    const casos: Array<[string, string]> = [
      [`/c/${SLUG}`, `https://${PREMIUM}/`],
      [`/catalogo-premium/${SLUG}`, `https://${PREMIUM}/`],
      [`/catalogo-premium/${SLUG}/productos?buscar=x`, `https://${PREMIUM}/tienda?buscar=x`],
      [`/catalogo-premium/${SLUG}/marca/zza-marca`, `https://${PREMIUM}/tienda/marca/zza-marca`],
      [`/catalogo-premium/${SLUG}/p/${productId}`, `https://${PREMIUM}/p/${productId}`],
      [`/catalogo-carta/${SLUG}/p/${productId}`, `https://${CARTA}/p/${productId}`],
      ['/kit-200k', 'https://onbikemargarita.com/200k'], // el kit es de OnBike: primer dominio premium del mapa
      ['/c/onbike', 'https://onbikemargarita.com/'],
    ]
    for (const [from, to] of casos) {
      const r = await get(request, null, from)
      expect([r.status, r.location], from).toEqual([301, to])
    }
    // Lo que no es de un dominio propio queda igual.
    expect((await get(request, null, '/catalogo-premium/otro-negocio')).status).not.toBe(301)
    expect((await get(request, null, '/')).status).toBe(200)
  })
})
