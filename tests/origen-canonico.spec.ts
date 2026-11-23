import { test, expect, type APIRequestContext } from '@playwright/test'
import { catalogOrigin } from '../src/lib/og/site-url'
import { parseCustomDomains } from '../src/lib/custom-domains'

/**
 * Origen canónico de sitemap, robots, canonical, og:url, og:image y JSON-LD: lista permitida (activopos.com + CUSTOM_DOMAINS),
 * nunca el Host reflejado. (1) Unitaria con production:true (NODE_ENV=production simulado). (2) De punta a punta contra `next dev`
 * en :3001 con x-forwarded-host (en desarrollo requestHost lo acepta). Solo LEE: OnBike, CafeConBike y ZZB. Arranque del servidor:
 *   CUSTOM_DOMAINS="onbikemargarita.com=onbike:premium,cafeconbike.com=cafeconbike:carta,premium.zza.test=zza-pruebas:premium,carta.zza.test=zza-pruebas:carta"
 *   E2E_BASE_URL=http://localhost:3001
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001'
const DOMAINS = parseCustomDomains('onbikemargarita.com=onbike:premium,cafeconbike.com=cafeconbike:carta')
const prod = (host: string | null): string => catalogOrigin(host, { production: true, domains: DOMAINS })

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } })

test.describe('catalogOrigin (producción simulada)', () => {
  test('solo activopos.com y los dominios propios; todo lo demás → activopos.com', () => {
    expect(prod('onbikemargarita.com')).toBe('https://onbikemargarita.com')
    expect(prod('cafeconbike.com')).toBe('https://cafeconbike.com')
    expect(prod('activopos.com')).toBe('https://activopos.com')
    expect(prod('evil.com')).toBe('https://activopos.com')
    expect(prod('onbikemargarita.com.evil.com')).toBe('https://activopos.com')
    expect(prod('evil.com, onbikemargarita.com')).toBe('https://activopos.com') // manda el primero de la lista del proxy
    expect(prod(null)).toBe('https://activopos.com')
    expect(prod('')).toBe('https://activopos.com')
  })

  test('www y mayúsculas/puerto colapsan al apex', () => {
    expect(prod('www.onbikemargarita.com')).toBe('https://onbikemargarita.com')
    expect(prod('WWW.OnBikeMargarita.COM')).toBe('https://onbikemargarita.com')
    expect(prod('onbikemargarita.com:443')).toBe('https://onbikemargarita.com')
    expect(prod('www.activopos.com')).toBe('https://activopos.com')
  })

  test('en producción localhost y direcciones internas tampoco se reflejan', () => {
    for (const h of ['localhost:3001', '127.0.0.1:3001', '10.0.0.5', '192.168.1.9:3000']) expect(prod(h), h).toBe('https://activopos.com')
  })

  test('en desarrollo localhost se conserva (para poder probar); el resto sigue sin reflejarse', () => {
    const dev = (h: string): string => catalogOrigin(h, { production: false, domains: DOMAINS })
    expect(dev('localhost:3001')).toBe('http://localhost:3001')
    expect(dev('evil.com')).toBe('https://activopos.com')
    expect(dev('onbikemargarita.com')).toBe('https://onbikemargarita.com')
  })
})

const get = (request: APIRequestContext, host: string, ruta: string, maxRedirects = 5) =>
  request.get(ruta, { maxRedirects, headers: { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } })
const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

test.describe('de punta a punta (Host simulado)', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const host of ['onbikemargarita.com', 'cafeconbike.com']) {
    test(`Host ${host}: sitemap.xml y robots.txt con URLs https://${host}/…`, async ({ request }) => {
      const sm = await get(request, host, '/sitemap.xml')
      expect(sm.status()).toBe(200)
      const urls = locs(await sm.text())
      // cafeconbike es un tenant que solo existe en producción: en la DB local su sitemap sale vacío (no hay URL de otro host que comprobar)
      if (host === 'onbikemargarita.com') expect(urls.length).toBeGreaterThan(1)
      expect(urls.filter(u => !u.startsWith(`https://${host}/`)), 'todas las URL del sitemap son del dominio').toEqual([])
      const rb = await (await get(request, host, '/robots.txt')).text()
      expect(rb).toContain(`Sitemap: https://${host}/sitemap.xml`)
      console.log(`Host ${host} → ${urls.length} URL, primera ${urls[0]} | robots: Sitemap: https://${host}/sitemap.xml`)
    })
  }

  test('Host evil.com: sitemap, robots, canonical y og:image salen con https://activopos.com (nunca evil.com)', async ({ request }) => {
    const sm = await (await get(request, 'evil.com', '/c/zzb-pruebas/sitemap.xml')).text()
    const urls = locs(sm)
    expect(urls.length).toBeGreaterThan(1)
    expect(urls.filter(u => !u.startsWith('https://activopos.com/c/zzb-pruebas'))).toEqual([])
    const rb = await (await get(request, 'evil.com', '/c/zzb-pruebas/robots.txt')).text()
    expect(rb).toContain('Sitemap: https://activopos.com/c/zzb-pruebas/sitemap.xml')
    expect(rb).not.toContain('evil.com')

    const html = await (await get(request, 'evil.com', '/catalogo-carta/zzb-pruebas')).text()
    const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'))
    expect(head).not.toContain('evil.com')
    expect(head).toContain('property="og:image" content="https://activopos.com/api/og/portada/zzb-pruebas')
    expect(head).toMatch(/rel="canonical" href="https:\/\/activopos\.com\/c\/zzb-pruebas"/)
    expect(html).not.toContain('evil.com') // tampoco en el JSON-LD ni en el cuerpo
    console.log(`Host evil.com → ${urls[0]} | robots: Sitemap: https://activopos.com/c/zzb-pruebas/sitemap.xml`)
  })

  test('Host www.onbikemargarita.com: redirige al apex (301) en sitemap y robots', async ({ request }) => {
    for (const ruta of ['/sitemap.xml', '/robots.txt']) {
      const r = await get(request, 'www.onbikemargarita.com', ruta, 0)
      expect([r.status(), r.headers()['location']], ruta).toEqual([301, `https://onbikemargarita.com${ruta}`])
    }
    console.log('Host www.onbikemargarita.com → 301 https://onbikemargarita.com/sitemap.xml y /robots.txt')
  })
})
