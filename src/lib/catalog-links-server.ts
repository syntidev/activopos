import { headers } from 'next/headers'
import { catalogLink, matchHost, type CustomDomain, type DomainKind } from './custom-domains'

/** Dominio propio de la petición actual (por el host que pone el proxy), o null en activopos.com y en local. */
export function currentCustomDomain(): CustomDomain | null {
  const h = headers()
  return matchHost(h.get('x-forwarded-host') ?? h.get('host'))?.domain ?? null
}

/** ¿Esta petición va al catálogo `slug`/`kind` por su dominio propio? (el slug sale del mapa: no se confía en la URL) */
export function isCleanFor(kind: DomainKind, slug: string): boolean {
  const d = currentCustomDomain()
  return !!d && d.kind === kind && d.slug === slug
}

/** Enlace del catálogo para componentes de SERVIDOR: limpio en el dominio propio del tenant, el de siempre en activopos.com. */
export function serverCatalogHref(kind: DomainKind, slug: string, ruta = ''): string {
  return catalogLink(kind, isCleanFor(kind, slug), slug, ruta)
}
