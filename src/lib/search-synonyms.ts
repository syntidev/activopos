import { z } from 'zod'
import { plano } from './catalog-deportes'

/**
 * Sinónimos de búsqueda por negocio: business.settings.search_synonyms = grupos de palabras/frases equivalentes.
 * En la búsqueda, cada palabra de la consulta se cumple si aparece CUALQUIER término de su grupo; entre palabras sigue
 * siendo Y. Sin grupos, la búsqueda es idéntica a la de siempre.
 */
export const SYNONYM_MAX_GROUPS = 60
export const SYNONYM_MAX_TERMS = 12
export const SYNONYM_MAX_CHARS = 40
/** Tope de términos a los que se expande UNA palabra: acota el WHERE de la búsqueda pública (cada término = 5 LIKE/EXISTS). */
const MAX_EXPANDED = 12
export type SynonymGroups = string[][]
export const NO_SYNONYMS: SynonymGroups = []

const term = z.string()
  .transform(s => plano(s).replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, 'No se permiten términos vacíos').max(SYNONYM_MAX_CHARS, `Cada término admite máximo ${SYNONYM_MAX_CHARS} caracteres`))

const group = z.array(term).max(SYNONYM_MAX_TERMS, `Cada grupo admite máximo ${SYNONYM_MAX_TERMS} términos`)
  .transform(g => Array.from(new Set(g)))
  .refine(g => g.length >= 2, 'Cada grupo necesita al menos 2 términos distintos')

/** Validación estricta (admin): normaliza y rechaza con mensaje claro. */
export const synonymsInputSchema = z.array(group).max(SYNONYM_MAX_GROUPS, `Máximo ${SYNONYM_MAX_GROUPS} grupos`)

/** Lectura tolerante de settings: descarta los grupos inválidos en vez de tumbar el catálogo. */
export function readSynonyms(settings: unknown): SynonymGroups {
  const raw = (settings as Record<string, unknown> | null)?.search_synonyms
  if (!Array.isArray(raw)) return []
  const out: SynonymGroups = []
  for (const g of raw.slice(0, SYNONYM_MAX_GROUPS)) {
    const r = group.safeParse(g)
    if (r.success) out.push(r.data)
  }
  return out
}

/** Términos equivalentes a `word` (incluida ella misma). Sin grupo: solo [word] normalizada. */
export function expandWord(word: string, groups: SynonymGroups): string[] {
  const w = plano(word)
  const terms = new Set([w])
  for (const g of groups) if (g.includes(w)) g.forEach(t => terms.add(t))
  return Array.from(terms).slice(0, MAX_EXPANDED) // la palabra misma va primero
}

/**
 * ¿`text` (ya normalizado con plano) cumple la consulta? Todas las palabras deben cumplirse, cada una por cualquiera de
 * sus términos. Si la consulta completa es una frase de un grupo ("reloj inteligente"), esa frase también basta.
 */
export function matchesWords(text: string, query: string, groups: SynonymGroups): boolean {
  const words = plano(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  if (words.every(w => expandWord(w, groups).some(t => text.includes(t)))) return true
  return words.length > 1 && expandWord(words.join(' '), groups).some(t => text.includes(t))
}
