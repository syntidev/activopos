import { prisma } from '@/lib/prisma'
import type { TitleHit, TitleSource } from '@/types/quick-add'

/**
 * Título de un producto a partir de su código de barras, en orden de confianza:
 * (a) label_captures del negocio, (b) bases públicas. Nunca se inventa un título:
 * si ninguna fuente lo conoce, devuelve null. La foto de la caja (visión) es aparte.
 */

const TITLE_MAX = 120
const FETCH_TIMEOUT_MS = 5_000
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

async function fromUpcItemDb(code: string): Promise<string> {
  // Modo gratuito (trial, con tope diario). Con UPCITEMDB_USER_KEY usa el plan de pago.
  const key = process.env.UPCITEMDB_USER_KEY
  const path = key ? 'v1' : 'trial'
  const headers: Record<string, string> = key ? { user_key: key, key_type: '3scale' } : {}
  const json = (await getJson(`https://api.upcitemdb.com/prod/${path}/lookup?upc=${code}`, headers)) as
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

/** Orden de consulta de las bases públicas (la primera que conozca el código gana). */
export const PUBLIC_SOURCES: readonly PublicSource[] = [
  { source: 'open_products_facts', fetch: factsLookup('world.openproductsfacts.org') },
  { source: 'open_food_facts', fetch: factsLookup('world.openfoodfacts.org') },
  { source: 'upcitemdb', fetch: fromUpcItemDb },
]

export async function lookupLabelCaptureTitle(businessId: number, code: string): Promise<TitleHit | null> {
  const title = await fromLabelCaptures(businessId, code)
  return title ? { title, source: 'label_captures' } : null
}

export async function lookupPublicTitle(code: string): Promise<TitleHit | null> {
  if (!GTIN_RE.test(code)) return null
  for (const { source, fetch: lookup } of PUBLIC_SOURCES) {
    const title = await lookup(code)
    if (title) return { title, source }
  }
  return null
}

export async function lookupTitle(businessId: number, code: string): Promise<TitleHit | null> {
  return (await lookupLabelCaptureTitle(businessId, code)) ?? (await lookupPublicTitle(code))
}
