export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type CatalogCurrency = 'usd' | 'bs' | 'both'

/* REGLA SELLADA (CLAUDE.md, Monetario): todo precio del catálogo muestra USD
   Y Bs simultáneamente, sin toggle. Por eso esto devuelve siempre ambos y
   catalog_default_currency queda SIN efecto visible (decisión de Carlos,
   2026-09-24). Reactivar un ajuste de moneda es una decisión nueva que se
   discute aparte -- no se vuelve a leer el parámetro por accidente.
   Se conserva la firma para no tocar las superficies que lo consumen. */
export function currencyVisibility(_c: string): { showUsd: boolean; showBs: boolean } {
  return { showUsd: true, showBs: true }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* Links de navegación del catálogo — fuente única para el nav superior
   (CatalogoGrid) y la barra de cierre del footer, que si no los repetiría
   hardcodeados y podrían quedar desincronizados. */
export function catalogNav(slug: string): { href: string; label: string }[] {
  return [
    { href: `/catalogo/${slug}`,           label: 'Inicio' },
    { href: `/catalogo/${slug}/productos`, label: 'Catálogo' },
  ]
}

// Validación simple de celular venezolano: acepta 0412…, 412…, 58412…
export function isValidVePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return /^(?:58|0)?(412|414|416|422|424|426)\d{7}$/.test(digits)
}
