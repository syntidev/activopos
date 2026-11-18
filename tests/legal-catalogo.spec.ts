import { test, expect, type APIRequestContext } from '@playwright/test'
import { sql } from './alta-helpers'
import { ownBusiness } from './helpers/own-business'
import { legalContent } from '../src/lib/catalog-legal'

/**
 * Páginas legales por defecto (/privacidad y /terminos) en las 3 plantillas y en dominios propios.
 * Mismo arranque que dominios-propios.spec.ts (next dev :3001 con CUSTOM_DOMAINS de prueba, E2E_BASE_URL=http://localhost:3001).
 * Solo toca el negocio de pruebas ZZA: cambia su plantilla y la restaura al terminar.
 */
const { businessId: BID, slug: SLUG } = ownBusiness()
const PREMIUM = 'premium.zza.test'
const CARTA = 'carta.zza.test'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

let original = ''

test.beforeAll(() => { original = sql(`SELECT catalog_template FROM businesses WHERE id=${BID}`) })
test.afterAll(() => { sql(`UPDATE businesses SET catalog_template='${original}' WHERE id=${BID}`) })

async function get(request: APIRequestContext, path: string, host?: string): Promise<{ status: number; text: string; location: string | null }> {
  const res = await request.get(path, { maxRedirects: 0, headers: host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {} })
  return { status: res.status(), text: await res.text(), location: res.headers()['location'] ?? null }
}

const PLANTILLAS = [
  { template: 'generic', base: `/catalogo/${SLUG}` },
  { template: 'premium', base: `/catalogo-premium/${SLUG}` },
  { template: 'carta',   base: `/catalogo-carta/${SLUG}` },
] as const

for (const { template, base } of PLANTILLAS) {
  test(`${template}: /privacidad y /terminos dan 200 con el contenido del negocio, enlazadas en el pie junto al crédito`, async ({ request }) => {
    sql(`UPDATE businesses SET catalog_template='${template}' WHERE id=${BID}`)
    const name = sql(`SELECT name FROM businesses WHERE id=${BID}`)
    const home = await get(request, base)
    expect(home.status).toBe(200)
    expect(home.text).toContain('data-testid="legal-links"')
    expect(home.text).toContain(`href="${base}/privacidad"`)
    expect(home.text).toContain(`href="${base}/terminos"`)
    expect(home.text).toContain('data-testid="platform-credit"')
    const priv = await get(request, `${base}/privacidad`)
    expect(priv.status).toBe(200)
    for (const s of [name, 'Política de privacidad', 'cédula', 'No vendemos tus datos']) expect(priv.text, s).toContain(s)
    const term = await get(request, `${base}/terminos`)
    expect(term.status).toBe(200)
    for (const s of ['Términos y condiciones', 'tasa BCV del día', 'sujeta al stock', 'según la política de la tienda']) expect(term.text, s).toContain(s)
    expect(term.text).toContain(`href="${base}/privacidad"`)
    expect((await get(request, `${base}/inexistente`)).status).toBe(404)
    // /c/<slug>/privacidad resuelve la plantilla y redirige a su ruta
    const c = await get(request, `/c/${SLUG}/privacidad`)
    expect([c.status, c.location]).toEqual([307, `${base}/privacidad`])
  })
}

test('la página legal de otra plantilla da 404 (premium no sirve a un negocio carta)', async ({ request }) => {
  sql(`UPDATE businesses SET catalog_template='carta' WHERE id=${BID}`)
  expect((await get(request, `/catalogo-premium/${SLUG}/privacidad`)).status).toBe(404)
  expect((await get(request, `/catalogo/${SLUG}/terminos`)).status).toBe(404)
})

test('dominio propio: /privacidad y /terminos dan 200 limpias, con canonical del dominio y el pie enlaza a ellas', async ({ request }) => {
  for (const [host, template] of [[PREMIUM, 'premium'], [CARTA, 'carta']] as const) {
    sql(`UPDATE businesses SET catalog_template='${template}' WHERE id=${BID}`)
    const home = await get(request, '/', host)
    expect(home.text, host).toContain('href="/privacidad"')
    expect(home.text, host).toContain('href="/terminos"')
    for (const doc of ['privacidad', 'terminos']) {
      const r = await get(request, `/${doc}`, host)
      expect(r.status, `${host}/${doc}`).toBe(200)
      expect(r.text).toContain(`<link rel="canonical" href="https://${host}/${doc}"`)
      expect(r.text).not.toContain('href="/catalogo-')
      expect(r.text).not.toContain('noindex')
    }
    // la nativa del propio tenant → 301 a la limpia, no al panel
    const nativa = await get(request, `/catalogo-${template}/${SLUG}/privacidad`, host)
    expect([nativa.status, nativa.location]).toEqual([301, `https://${host}/privacidad`])
  }
})

test('activopos.com: /privacidad sigue siendo la página de marketing de la plataforma', async ({ request }) => {
  const r = await get(request, '/privacidad')
  expect(r.status).toBe(200)
  expect(r.text).not.toContain('data-testid="legal-page"')
})

test('texto: sin datos del negocio se omiten las frases (sin RIF, dirección, teléfono ni correo)', () => {
  const vacio = { name: 'Tienda X', legal_name: null, rif: null, address: null, city: null, state: null, phone: null, email: null }
  const plano = (doc: 'privacidad' | 'terminos', b: typeof vacio): string => legalContent(doc, b).sections.map(s => s.paragraphs.join(' ')).join(' ')
  const todo = plano('privacidad', vacio) + plano('terminos', vacio)
  expect(todo).not.toMatch(/RIF|null|undefined|al correo|al \d/)
  expect(todo).toContain('Este catálogo es de Tienda X.')
  expect(todo).toContain('contáctanos directamente en la tienda')
  const lleno = { ...vacio, legal_name: 'Tienda X C.A.', rif: 'J-12345678-9', address: 'Av. 1', city: 'Porlamar', state: 'Nueva Esparta', phone: '04141234567', email: 'a@b.com' }
  const p = plano('privacidad', lleno)
  expect(p).toContain('Tienda X C.A., RIF J-12345678-9, Av. 1, Porlamar, Nueva Esparta.')
  expect(p).toContain('por WhatsApp al 04141234567 o al correo a@b.com')
  expect(p).not.toMatch(/Ley|Artículo|art\./)
})
