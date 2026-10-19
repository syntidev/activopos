import { prisma } from '@/lib/prisma'
import type { TitleHit, TitleSource } from '@/types/quick-add'

/**
 * Título de un producto a partir de su código de barras, en orden de confianza:
 * (a) label_captures del negocio, (b) bases públicas. Nunca se inventa un título:
 * si ninguna fuente lo conoce, devuelve null. La foto de la caja (visión) es aparte.
 */

const TITLE_MAX = 120
/** Las bases públicas casi nunca conocen estos productos: no deben demorar el formulario. */
const FETCH_TIMEOUT_MS = 2_000
const USER_AGENT = 'ActivoPOS/1.0 (hola@activopos.com)'
/** Las bases públicas solo conocen GTIN de 8 a 14 dígitos. */
const GTIN_RE = /^\d{8,14}$/

export function cleanTitle(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX)
}

/** GET JSON con tope de tiempo. Cualquier fallo (red, 404, no-JSON) = null: la fuente no responde. */
async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

interface FactsResponse {
  product?: { product_name?: unknown }
}

function factsLookup(host: string): (code: string) => Promise<string> {
  return async code => {
    const url = `https://${host}/api/v2/product/${code}.json?fields=product_name`
    return cleanTitle(((await getJson(url)) as FactsResponse | null)?.product?.product_name)
  }
}

async function fromUpcItemDb(code: string, key: string): Promise<string> {
  const json = (await getJson(`https://api.upcitemdb.com/prod/v1/lookup?upc=${code}`, { user_key: key, key_type: '3scale' })) as
    | { items?: { title?: unknown }[] }
    | null
  return cleanTitle(json?.items?.[0]?.title)
}

async function fromLabelCaptures(businessId: number, code: string): Promise<string> {
  const row = await prisma.labelCapture.findUnique({
    where: { business_id_ean: { business_id: businessId, ean: code } },
    select: { model_name: true },
  })
  return cleanTitle(row?.model_name)
}

type PublicSource = { source: TitleSource; fetch: (code: string) => Promise<string> }

/**
 * Bases públicas, en orden de confianza. UPCitemdb solo entra con UPCITEMDB_USER_KEY: su modo gratuito
 * exige una pausa de ~11 s entre consultas (6/min) y no es viable en un flujo continuo.
 */
export function publicSources(): readonly PublicSource[] {
  const key = process.env.UPCITEMDB_USER_KEY
  return [
    { source: 'open_products_facts', fetch: factsLookup('world.openproductsfacts.org') },
    { source: 'open_food_facts', fetch: factsLookup('world.openfoodfacts.org') },
    ...(key ? [{ source: 'upcitemdb' as const, fetch: (code: string) => fromUpcItemDb(code, key) }] : []),
  ]
}

export async function lookupLabelCaptureTitle(businessId: number, code: string): Promise<TitleHit | null> {
  const title = await fromLabelCaptures(businessId, code)
  return title ? { title, source: 'label_captures' } : null
}

export async function lookupPublicTitle(code: string): Promise<TitleHit | null> {
  if (!GTIN_RE.test(code)) return null
  // En paralelo (tope de 2 s en total); gana la primera de la lista que tenga título.
  const sources = publicSources()
  const titles = await Promise.all(sources.map(({ fetch: lookup }) => lookup(code)))
  const i = titles.findIndex(Boolean)
  return i < 0 ? null : { title: titles[i], source: sources[i].source }
}

export async function lookupTitle(businessId: number, code: string): Promise<TitleHit | null> {
  return (await lookupLabelCaptureTitle(businessId, code)) ?? (await lookupPublicTitle(code))
}
