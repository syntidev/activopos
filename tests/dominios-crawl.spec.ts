import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { sql } from './alta-helpers'

/**
 * Crawl de enlaces en dominio propio (SOLO LECTURA sobre OnBike / CafeConBike).
 * Todo <a href> visible debe quedarse en el dominio y responder 200 (tras redirects, sin acabar en /login).
 * Únicas salidas permitidas: WhatsApp, redes y el crédito "Desarrollado por ActivoPOS.com" del footer.
 * Host simulado con x-forwarded-host (válido solo fuera de producción, ver requestHost()).
 */

const ONBIKE = 'onbikemargarita.com'
const CAFE = 'cafeconbike.com'
const EXTERNAL_OK = ['wa.me', 'api.whatsapp.com', 'instagram.com', 'www.instagram.com', 'facebook.com', 'www.facebook.com', 'tiktok.com', 'www.tiktok.com', 'youtube.com', 'www.youtube.com', 'x.com']
const MAX_HOPS = 5

test.describe.configure({ mode: 'serial', timeout: 240_000 })

interface Anchor { href: string; inFooter: boolean }
interface Report { page: string; href: string; problem: string }

const headersFor = (host: string): Record<string, string> => ({ 'x-forwarded-host': host, 'x-forwarded-proto': 'https' })

async function anchors(page: Page): Promise<Anchor[]> {
  return page.$$eval('a[href]', els => els.map(a => ({ href: a.getAttribute('href') ?? '', inFooter: !!a.closest('footer') })))
}

/** Sigue redirects a mano; un Location absoluto al mismo dominio se reubica en el servidor local. */
async function resolve(request: APIRequestContext, host: string, path: string): Promise<{ status: number; final: string; hops: string[] }> {
  let current = path
  const hops: string[] = []
  for (let i = 0; i <= MAX_HOPS; i++) {
    const res = await request.get(current, { maxRedirects: 0, headers: headersFor(host) })
    const loc = res.headers()['location']
    if (res.status() >= 300 && res.status() < 400 && loc) {
      const u = new URL(loc, `https://${host}`)
      hops.push(`${res.status()} ${loc}`)
      if (u.host !== host) return { status: res.status(), final: `${u.host}${u.pathname}`, hops } // salió del dominio
      current = `${u.pathname}${u.search}`
      continue
    }
    return { status: res.status(), final: current, hops }
  }
  return { status: 599, final: current, hops }
}

async function auditPage(context: BrowserContext, host: string, path: string, seen: Map<string, string>, report: Report[]): Promise<void> {
  const page = await context.newPage()
  const res = await page.goto(path, { waitUntil: 'networkidle' })
  // Página 404 (p. ej. /guia/garmin o /200k sin configuración en la DB local): se valida contra la ruta nativa más abajo, no se recorre su página de error.
  if (res?.status() === 404) { await page.close(); return }
  for (const { href, inFooter } of await anchors(page)) {
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/.test(href)) continue
    if (/^https?:\/\//i.test(href)) {
      const u = new URL(href)
      if (u.host === host) { seen.set(`${u.pathname}${u.search}`, path); continue }
      if (EXTERNAL_OK.includes(u.host)) continue
      if (u.host === 'activopos.com' && inFooter) continue // crédito intencional
      report.push({ page: path, href, problem: 'sale del dominio' })
      continue
    }
    if (href.startsWith('/')) seen.set(href, path)
  }
  await page.close()
}

async function crawl(request: APIRequestContext, context: BrowserContext, host: string, start: string[]): Promise<{ checked: number; report: Report[] }> {
  const seen = new Map<string, string>()
  const report: Report[] = []
  for (const p of start) await auditPage(context, host, p, seen, report)
  for (const [href, from] of seen) {
    const r = await resolve(request, host, href.replace(/#.*$/, ''))
    // /200k y /guia/garmin dependen de la config de OnBike: si localmente dan 404, se compara con la ruta nativa más abajo.
    if (r.status === 404 && /^\/(200k|guia\/garmin)$/.test(href.split('?')[0])) continue
    if (r.status !== 200) report.push({ page: from, href, problem: `${r.status} ${r.hops.join(' | ')}` })
    else if (/\/login/.test(r.final)) report.push({ page: from, href, problem: `termina en ${r.final}` })
  }
  return { checked: seen.size, report }
}

test('OnBike: todo enlace visible se queda en el dominio y responde 200', async ({ browser, request }) => {
  const bid = sql(`SELECT id FROM businesses WHERE catalog_slug='onbike' LIMIT 1`)
  test.skip(!bid, 'OnBike no existe en esta DB')
  const ficha = sql(`SELECT id FROM products WHERE business_id=${bid} AND active=1 AND show_in_catalog=1 AND catalog_visibility='visible' ORDER BY id LIMIT 1`)
  const marca = sql(`SELECT LOWER(REPLACE(name,' ','-')) FROM brands WHERE business_id=${bid} AND visible=1 ORDER BY id LIMIT 1`)
  const context = await browser.newContext({ extraHTTPHeaders: headersFor(ONBIKE) })
  const start = ['/', '/tienda', '/productos', ...(marca ? [`/tienda/marca/${marca}`] : []), ...(ficha ? [`/p/${ficha}`] : []), '/200k', '/guia/garmin']
  const out = await crawl(request, context, ONBIKE, start)
  await context.close()
  expect(out.checked, 'el crawl debe encontrar enlaces').toBeGreaterThan(5)
  expect(out.report, JSON.stringify(out.report, null, 1)).toEqual([])
  // /200k y /guia/garmin: deben responder igual que su ruta nativa (200 en prod; 404 local si OnBike no tiene kit/guía)
  for (const [clean, native] of [['/200k', '/kit-200k'], ['/guia/garmin', '/catalogo-premium/onbike/guia/garmin']]) {
    const viaDomain = (await request.get(clean, { maxRedirects: 0, headers: headersFor(ONBIKE) })).status()
    expect(viaDomain, clean).toBe((await request.get(native, { maxRedirects: 0 })).status())
  }
})

test('CafeConBike (carta): enlaces del dominio y salidas permitidas', async ({ browser, request }) => {
  const bid = sql(`SELECT id FROM businesses WHERE catalog_slug='cafeconbike' LIMIT 1`)
  test.skip(!bid, 'cafeconbike no existe en esta DB')
  const context = await browser.newContext({ extraHTTPHeaders: headersFor(CAFE) })
  const out = await crawl(request, context, CAFE, ['/'])
  await context.close()
  expect(out.report, JSON.stringify(out.report, null, 1)).toEqual([])
})
