// Subcategorías de producto: texto libre (max 60) → enlaces y claves normalizadas.

/** URL del listado de productos filtrado por categoría (y subcategoría opcional). */
export function productosHref(catalogUrl: string, category: string, subcategory?: string | null): string {
  const params = [`categoria=${encodeURIComponent(category)}`]
  if (subcategory) params.push(`sub=${encodeURIComponent(subcategory)}`)
  return `${catalogUrl}/productos?${params.join('&')}`
}
