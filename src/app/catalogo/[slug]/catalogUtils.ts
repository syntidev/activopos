export function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtBs(n: number): string {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type CatalogCurrency = 'usd' | 'bs' | 'both'

/* Qué monedas ve el visitante del catálogo. Devuelve flags y no un string
   armado porque cada superficie maqueta USD y Bs en elementos separados con
   su propia clase CSS — un string ya formateado obligaría a reescribir el
   markup de las tres pantallas.

   Un valor desconocido en la columna cae a solo USD en vez de esconder todo:
   ante datos corruptos, un precio visible es mejor que ninguno. */
export function currencyVisibility(c: string): { showUsd: boolean; showBs: boolean } {
  if (c === 'bs')   return { showUsd: false, showBs: true }
  if (c === 'both') return { showUsd: true,  showBs: true }
  return { showUsd: true, showBs: false }
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
