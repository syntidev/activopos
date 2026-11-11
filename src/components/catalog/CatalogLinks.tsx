'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { catalogLink, normalizeStoredHref, type CustomDomain, type DomainKind } from '@/lib/custom-domains'

/**
 * Enlaces del catálogo según el host: en un dominio propio (onbikemargarita.com, cafeconbike.com) salen las rutas LIMPIAS del mapa;
 * en activopos.com, las de siempre (/catalogo-premium/<slug>/…, /catalogo-carta/<slug>/…). El layout del catálogo (servidor) decide
 * `clean` por el host de la petición y lo entrega aquí; los componentes de cliente solo llaman a `useCatalogHref`.
 */
interface LinksCtx { kind: DomainKind; clean: boolean; domain?: CustomDomain | null }

const CatalogLinksContext = createContext<LinksCtx | null>(null)

export function CatalogLinksProvider({ kind, clean, domain = null, children }: LinksCtx & { children: ReactNode }): JSX.Element {
  return <CatalogLinksContext.Provider value={{ kind, clean, domain }}>{children}</CatalogLinksContext.Provider>
}

/** Enlaces GUARDADOS en la DB (cta_link…): en el dominio propio se convierten a la ruta limpia relativa; en activopos.com quedan igual. */
export function useStoredHref(): (href: string) => string {
  const ctx = useContext(CatalogLinksContext)
  return (href: string) => (ctx?.clean && ctx.domain ? normalizeStoredHref(ctx.domain, href) : href)
}

/** Construye enlaces del catálogo del tenant `slug` (`ruta` nativa: '', '/productos', '/p/5', '/marca/x', '/guia/garmin', '#marcas'). Sin provider (p. ej. /kit-200k) usa las rutas de siempre. */
export function useCatalogHref(slug: string, fallbackKind: DomainKind = 'premium'): (ruta?: string) => string {
  const ctx = useContext(CatalogLinksContext)
  return (ruta = '') => catalogLink(ctx?.kind ?? fallbackKind, ctx?.clean ?? false, slug, ruta)
}

/** Ruta del kit 200K: en el dominio propio premium es /200k. */
export function useKitHref(): string {
  const ctx = useContext(CatalogLinksContext)
  return ctx?.clean && ctx.kind === 'premium' ? '/200k' : '/kit-200k'
}
