/**
 * Dominios propios de tenants (onbikemargarita.com, cafeconbike.com…). SIN cambio de esquema: el mapa vive en la variable de entorno
 * CUSTOM_DOMAINS y el middleware no consulta la DB.
 *
 *   CUSTOM_DOMAINS="onbikemargarita.com=onbike:premium,cafeconbike.com=cafeconbike:carta"
 *   formato: dominio=slug[:plantilla]  (plantilla = premium | carta; por defecto premium)
 *
 * La plantilla va en la variable porque el middleware (Edge) no puede leer la DB para saber qué ruta interna servir.
 * Módulo puro (sin next/headers ni Node): lo usan el middleware, los componentes de cliente y los metadatos.
 *
 * SEGURIDAD: el host de la petición solo se COMPARA contra esta lista; ningún redirect se arma con el host recibido
 * (siempre sale del mapa) y el tenant sale del mapa, nunca de la URL ni del body.
 */

export type DomainKind = 'premium' | 'carta'

export interface CustomDomain {
  host: string
  slug: string
  kind: DomainKind
}

const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const SLUG_RE = /^[a-z0-9-]{3,50}$/
const ID_RE = /^\d{1,9}$/
const MARCA_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i

/** Lee y VALIDA el valor de CUSTOM_DOMAINS: lo inválido (host, slug o plantilla) se ignora; no se repiten hosts ni se acepta "www.". */
export function parseCustomDomains(raw: string | undefined | null): CustomDomain[] {
  const out: CustomDomain[] = []
  for (const part of (raw ?? '').split(',')) {
    const [host, rest] = part.trim().toLowerCase().split('=')
    if (!host || !rest) continue
    const [slug, kind = 'premium'] = rest.split(':')
    if (!HOST_RE.test(host) || host.startsWith('www.') || !SLUG_RE.test(slug) || (kind !== 'premium' && kind !== 'carta')) continue
    if (out.some(d => d.host === host)) continue
    out.push({ host, slug, kind })
  }
  return out
}

let cache: { raw: string; list: CustomDomain[] } | null = null

export function getCustomDomains(): CustomDomain[] {
  const raw = process.env.CUSTOM_DOMAINS ?? ''
  if (!cache || cache.raw !== raw) cache = { raw, list: parseCustomDomains(raw) }
  return cache.list
}

/** Host de la petición sin puerto, en minúsculas y sin punto final. Toma el primero si el proxy manda una lista. */
export function normalizeHost(raw: string | null | undefined): string {
  return (raw ?? '').split(',')[0].trim().toLowerCase().replace(/:\d{1,5}$/, '').replace(/\.$/, '')
}

export interface DomainMatch { domain: CustomDomain; www: boolean }

/** Dominio propio al que pertenece el host (o su variante www). null = no es un dominio propio. */
export function matchHost(rawHost: string | null | undefined, list: readonly CustomDomain[] = getCustomDomains()): DomainMatch | null {
  const host = normalizeHost(rawHost)
  if (!host) return null
  for (const domain of list) {
    if (host === domain.host) return { domain, www: false }
    if (host === `www.${domain.host}`) return { domain, www: true }
  }
  return null
}

/* ── Tabla de rutas LIMPIAS ↔ rutas nativas de cada plantilla (una sola fuente) ─────────────────────────────
   premium: /  /tienda  /tienda/marca/:m  /p/:id  /guia/garmin  (+ /200k → /kit-200k)
   carta:   /  /p/:id
   "nativa" = lo que va después de /catalogo-premium/<slug> o /catalogo-carta/<slug> ('' = inicio). */

export const KIT_NATIVE = '/kit-200k'
export const KIT_CLEAN = '/200k'

const stripSlash = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/'

/** Ruta limpia → ruta nativa (sufijo). null = fuera del mapa. */
export function cleanToNative(kind: DomainKind, pathname: string): string | null {
  const p = stripSlash(pathname)
  if (p === '/') return ''
  const id = /^\/p\/([^/]+)$/.exec(p)
  if (id) return ID_RE.test(id[1]) ? `/p/${id[1]}` : null
  if (kind === 'carta') return null
  if (p === '/tienda') return '/productos'
  if (p === '/guia/garmin') return '/guia/garmin'
  const marca = /^\/tienda\/marca\/([^/]+)$/.exec(p)
  return marca && MARCA_RE.test(marca[1]) ? `/marca/${marca[1]}` : null
}

/** Ruta nativa (sufijo) → ruta limpia. null = no tiene equivalente limpio. Admite query/hash al final. */
export function nativeToClean(kind: DomainKind, suffix: string): string | null {
  const m = /^([^?#]*)([?#].*)?$/.exec(suffix)
  const base = stripSlash(m?.[1] || '/')
  const tail = m?.[2] ?? ''
  if (base === '/') return `/${tail}`
  const id = /^\/p\/([^/]+)$/.exec(base)
  if (id) return ID_RE.test(id[1]) ? `/p/${id[1]}${tail}` : null
  if (kind === 'carta') return null
  if (base === '/productos') return `/tienda${tail}`
  if (base === '/guia/garmin') return `/guia/garmin${tail}`
  const marca = /^\/marca\/([^/]+)$/.exec(base)
  return marca && MARCA_RE.test(marca[1]) ? `/tienda/marca/${marca[1]}${tail}` : null
}

/** Ruta interna a la que se REESCRIBE una petición a un dominio propio (null = 404). */
export function rewriteTarget(d: CustomDomain, pathname: string): string | null {
  const p = stripSlash(pathname)
  if (d.kind === 'premium' && p === KIT_CLEAN) return KIT_NATIVE
  const native = cleanToNative(d.kind, p)
  return native === null ? null : `${d.kind === 'premium' ? '/catalogo-premium' : '/catalogo-carta'}/${d.slug}${native}`
}

/** Ruta limpia equivalente a una ruta nativa/legada del PROPIO tenant (/catalogo-premium/<slug>/…, /c/<slug>/…, /kit-200k). */
export function legacyToClean(d: CustomDomain, pathname: string): string | null {
  const p = stripSlash(pathname)
  if (d.kind === 'premium' && p === KIT_NATIVE) return KIT_CLEAN
  for (const prefix of ['/c/', d.kind === 'premium' ? '/catalogo-premium/' : '/catalogo-carta/']) {
    if (!p.startsWith(prefix)) continue
    const [slug, ...tail] = p.slice(prefix.length).split('/')
    if (slug !== d.slug) return null
    return nativeToClean(d.kind, tail.length ? `/${tail.join('/')}` : '')
  }
  return null
}

/** Enlaces del catálogo en un dominio propio: `ruta` es la nativa (''; '/productos'; '/p/5'; '/marca/x'; '/guia/garmin'; '#marcas'; con query). */
export function cleanHref(kind: DomainKind, ruta: string): string {
  if (ruta.startsWith('#')) return `/${ruta}`
  return nativeToClean(kind, ruta || '') ?? `/${ruta.replace(/^\//, '')}`
}

const NATIVE_BASE: Record<DomainKind, string> = { premium: '/catalogo-premium', carta: '/catalogo-carta' }

/** Enlace del catálogo: limpio en un dominio propio (`clean`), el de siempre en activopos.com. `ruta` es la nativa ('' = inicio). */
export function catalogLink(kind: DomainKind, clean: boolean, slug: string, ruta = ''): string {
  return clean ? cleanHref(kind, ruta) : `${NATIVE_BASE[kind]}/${slug}${ruta}`
}

/** Bandera de redirección de lo viejo (CUSTOM_DOMAINS_REDIRECT=on). Apagada por defecto. */
export const redirectFlagOn = (): boolean => (process.env.CUSTOM_DOMAINS_REDIRECT ?? '').trim().toLowerCase() === 'on'

/** El panel vive solo aquí. */
export const PANEL_ORIGIN = 'https://activopos.com'
