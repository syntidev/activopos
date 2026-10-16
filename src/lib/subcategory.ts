// Subcategorías de producto: texto libre (max 60) → enlaces y claves normalizadas.

/** URL del listado de productos filtrado por categoría (y subcategoría opcional). */
export function productosHref(catalogUrl: string, category: string, subcategory?: string | null): string {
  const params = [`categoria=${encodeURIComponent(category)}`]
  if (subcategory) params.push(`sub=${encodeURIComponent(subcategory)}`)
  return `${catalogUrl}/productos?${params.join('&')}`
}

/** Quita espacios en los extremos y colapsa los internos. No toca mayúsculas ni acentos. */
export function cleanSubcategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Clave de comparación: limpia, minúsculas y sin acentos ("Frenos " ≡ "frenos" ≡ "FRÉNOS"). */
export function subcategoryKey(raw: string): string {
  return cleanSubcategory(raw).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface SubcategoryChip {
  key:   string
  label: string
}

const COLLATOR = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

/** Un chip por clave; muestra la escritura más frecuente (empate: la primera por orden alfabético). */
export function subcategoryChips(values: ReadonlyArray<string | null>): SubcategoryChip[] {
  const spellings = new Map<string, Map<string, number>>()
  for (const raw of values) {
    if (!raw) continue
    const key = subcategoryKey(raw)
    if (!key) continue
    const label  = cleanSubcategory(raw)
    const counts = spellings.get(key) ?? new Map<string, number>()
    counts.set(label, (counts.get(label) ?? 0) + 1)
    spellings.set(key, counts)
  }
  const chips: SubcategoryChip[] = []
  for (const [key, counts] of Array.from(spellings.entries())) {
    const [label] = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0]
    chips.push({ key, label })
  }
  return chips.sort((a, b) => COLLATOR.compare(a.label, b.label))
}
