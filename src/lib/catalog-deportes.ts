/**
 * "¿Qué practicas?": deportes de un producto, leídos de la línea "Deportes: A, B, C" de su descripción.
 * Sin esa línea no hay deportes y nada de esto se muestra (genérico para cualquier negocio).
 */

export interface Deporte {
  slug:  string
  label: string
}

const ORDEN_FIJO = ['Running', 'Ciclismo', 'Natación', 'Triatlón', 'Outdoor', 'Día a día', 'Náutica', 'Ecuestre']

/** Minúsculas, sin tildes, espacios a guiones: "Día a día" → "dia-a-dia". */
export function deporteSlug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Texto en minúsculas y sin tildes para comparar búsquedas. */
export function plano(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Insensible a mayúsculas y tildes: "DEPORTES:", "Deportes :" o el mismo texto sin acentos.
const LINEA_DEPORTES = /^\s*deportes\s*:\s*(.*)$/i

const LABEL_FIJO = new Map(ORDEN_FIJO.map(l => [deporteSlug(l), l]))
const SLUGS_FIJOS = ORDEN_FIJO.map(deporteSlug)

/** Deportes de la descripción (sin repetir), con el nombre canónico si es uno del orden fijo. */
export function parseDeportes(description: string | null | undefined): Deporte[] {
  if (!description) return []
  const seen = new Set<string>()
  const out: Deporte[] = []
  for (const linea of description.split(/\r?\n/)) {
    const m = LINEA_DEPORTES.exec(linea)
    if (!m) continue
    for (const raw of m[1].split(',')) {
      const label = raw.trim()
      const slug = deporteSlug(label)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      out.push({ slug, label: LABEL_FIJO.get(slug) ?? label })
    }
  }
  return out
}

/** Descripción sin la línea "Deportes:" (esa se muestra como chips, no como texto). */
export function descripcionSinDeportes(description: string): string {
  return description.split(/\r?\n/).filter(l => !LINEA_DEPORTES.test(l)).join('\n').trim()
}

/** Deportes únicos de varios productos: orden fijo primero, los demás alfabéticamente. */
export function deportesDeProductos(descriptions: Array<string | null | undefined>): Deporte[] {
  const all = new Map<string, Deporte>()
  for (const d of descriptions) for (const dep of parseDeportes(d)) if (!all.has(dep.slug)) all.set(dep.slug, dep)
  return Array.from(all.values()).sort((a, b) => {
    const ia = SLUGS_FIJOS.indexOf(a.slug), ib = SLUGS_FIJOS.indexOf(b.slug)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.label.localeCompare(b.label, 'es')
  })
}
