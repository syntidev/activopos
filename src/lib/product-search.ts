import type { Prisma } from '@prisma/client'
import { expandWord, type SynonymGroups } from '@/lib/search-synonyms'
import { SIZE_LETTERS as CANON_LETTERS } from '@/lib/talla-canonica'

/**
 * Búsqueda ÚNICA de productos (Productos, POS cámara/texto/pistola, catálogo público y Alta rápida).
 * Un solo input busca a la vez en: nombre, barcode del producto, SKU del producto, "Ref" en la descripción,
 * SKU de variante (contiene), barcode de variante (EXACTO) y valor de variante (talla/color).
 * Varias palabras = AND entre palabras, OR entre campos.
 * TALLAS: "talla X", "t. X", "US/EU/UK X", un decimal ("12,5" = "12.5") o una letra de ropa SOLA ("XL") se comparan contra
 * el VALOR de la variante como token exacto (separado por espacio, ·, / o -): "12" no trae 12.5, "L" no trae XL.
 * Solo construye filtros y calcula la variante que coincidió; business_id lo pone quien llama (sesión o slug).
 */

export const SEARCH_MAX_CHARS = 60
export const SEARCH_MAX_WORDS = 5
/** Un barcode exacto necesita señal suficiente: con menos de 4 caracteres solo se busca por texto. */
export const MIN_CODE_CHARS = 4

// Letras de ropa: las de la talla canónica + el alias que la gente escribe ("xxl")
const SIZE_LETTERS = new Set(Array.from(CANON_LETTERS).concat('xxl'))
const SIZE_NUM = /^\d{1,2}(?:[.,]\d)?$/
const SIZE_DECIMAL = /^\d{1,2}[.,]\d$/
/** Separadores entre tokens de un valor de variante: "US 9 · EU 42.5", "S/M", "M-Azul". */
const DELIMS = [' ', '·', '/', '-'] as const

export interface ParsedSearch {
  /** Texto limpio (sin controles, espacios colapsados, ≤ 60 caracteres). '' si no hay búsqueda. */
  q:     string
  /** Palabras para nombre/descripción/SKU (máx. 5), sin las tallas. El prefijo suelto "Ref"/"Ref:" no cuenta como palabra. */
  words: string[]
  /** Tallas pedidas (decimales con punto, letras en mayúscula): token exacto contra el valor de la variante. */
  sizes: string[]
  /** Posible barcode exacto: el texto sin espacios si son solo dígitos (4+), o un token alfanumérico sin espacios. */
  code:  string | null
}

function extractSizes(tokens: string[]): { sizes: string[]; rest: string[] } {
  const sizes: string[] = []
  const rest: string[] = []
  const num = (t: string): string => t.replace(',', '.')
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase()
    const next = tokens[i + 1]
    const nextOk = next !== undefined && (SIZE_NUM.test(next) || SIZE_LETTERS.has(next.toLowerCase()))
    if ((t === 'talla' || t === 't.') && nextOk) { sizes.push(num(next).toUpperCase()); i++; continue }
    if ((t === 'us' || t === 'eu' || t === 'uk') && next !== undefined && SIZE_NUM.test(next)) { sizes.push(num(next)); i++; continue }
    if (SIZE_DECIMAL.test(t)) { sizes.push(num(t)); continue }
    if (tokens.length === 1 && SIZE_LETTERS.has(t)) { sizes.push(t.toUpperCase()); continue }
    rest.push(tokens[i])
  }
  return { sizes: Array.from(new Set(sizes)), rest }
}

export function parseSearch(raw: string | null | undefined): ParsedSearch {
  const q = (raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_CHARS)
  if (!q) return { q: '', words: [], sizes: [], code: null }
  let words = q.split(' ').slice(0, SEARCH_MAX_WORDS)
  const sinRef = words.filter(w => !/^ref:?$/i.test(w))
  if (sinRef.length > 0) words = sinRef
  const { sizes, rest } = extractSizes(words)
  const compact = q.replace(/\s+/g, '')
  const code = sizes.length > 0 ? null
    : /^\d+$/.test(compact) && compact.length >= MIN_CODE_CHARS
      ? compact
      : !/\s/.test(q) && /^[A-Za-z0-9._-]+$/.test(q) && q.length >= MIN_CODE_CHARS ? q : null
  return { q, words: sizes.length > 0 ? rest : words, sizes, code }
}

/** ¿La consulta trae talla? El catálogo la usa para buscar con 1-2 letras ("XL", "M") y no filtrar por substring en local. */
export const hasSizeQuery = (raw: string): boolean => parseSearch(raw).sizes.length > 0

/** Valor de variante == token exacto: igual, o rodeado por separadores (o por el borde del texto). */
const tokenClauses = (x: string): Prisma.ProductVariantWhereInput[] => [
  { valor: { equals: x } },
  ...DELIMS.map(d => ({ valor: { startsWith: x + d } })),
  ...DELIMS.map(d => ({ valor: { endsWith: d + x } })),
  ...DELIMS.flatMap(a => DELIMS.map(b => ({ valor: { contains: a + x + b } }))),
]

export function valueHasToken(valor: string, size: string): boolean {
  return valor.toLowerCase().split(/[\s·/-]+/).includes(size.toLowerCase())
}

export interface SearchOptions {
  /** Catálogo público: la talla pedida debe tener existencias (un servicio no lleva inventario: basta que exista). */
  inStockOnly?: boolean
}

/** Filtro de Prisma para Product (sin business_id: lo inyecta la capa de tenant o lo agrega quien llama). */
export function productSearchWhere(p: ParsedSearch, synonyms: SynonymGroups = [], opts: SearchOptions = {}): Prisma.ProductWhereInput | null {
  if (!p.q) return null
  const term = (w: string): Prisma.ProductWhereInput => ({
    OR: [
      { name:        { contains: w } },
      { sku:         { contains: w } },
      { barcode:     { contains: w } },
      { description: { contains: w } },   // "Ref: 11953H" vive en la descripción
      { variants:    { some: { is_active: true, sku: { contains: w } } } },
      // Valor de la variante: un número suelto es talla (EU 34-50 en Venezuela, US ≤16): token exacto y, en el catálogo, con
      // existencias ("45" no trae EU 45.5; "12" no trae 12.5). Texto ("Arena") por contiene.
      /^\d+$/.test(w)
        ? sizeClause(w)
        : { variants: { some: { is_active: true, valor: { contains: w } } } },
    ],
  })
  const sizeClause = (x: string): Prisma.ProductWhereInput => {
    const some = (extra: Prisma.ProductVariantWhereInput): Prisma.ProductWhereInput =>
      ({ variants: { some: { is_active: true, OR: tokenClauses(x), ...extra } } })
    return opts.inStockOnly ? { OR: [some({ stock: { gt: 0 } }), { sale_mode: 'service', ...some({}) }] } : some({})
  }
  // Con sinónimos, la palabra se cumple por cualquier término de su grupo; sin grupos expandWord devuelve [w] (+ normaliza).
  const word = (w: string): Prisma.ProductWhereInput =>
    synonyms.length === 0 ? term(w) : { OR: expandWord(w, synonyms).map(term) }
  const conds = [...p.words.map(word), ...p.sizes.map(sizeClause)]
  const or: Prisma.ProductWhereInput[] = [{ AND: conds }]
  if (p.sizes.length === 0) {
    // La consulta completa como frase de un grupo ("reloj inteligente")
    if (synonyms.length > 0 && p.words.length > 1) or.push(word(p.words.join(' ')))
    // La frase completa contra un SKU que lleva espacios ("21216H UNICO COLOR XS")
    or.push({ sku: { contains: p.q } })
    or.push({ variants: { some: { is_active: true, sku: { contains: p.q } } } })
  }
  if (p.code) {
    or.push({ barcode: p.code })
    or.push({ variants: { some: { is_active: true, barcode: p.code } } })
  }
  return { OR: or }
}

export interface SearchableVariant {
  id:      number
  valor:   string
  sku:     string | null
  barcode: string | null
}

export interface MatchedVariant {
  matched_variant_id:    number | null
  matched_variant_value: string | null
  matched_by:            'barcode' | 'sku' | 'size' | null
}

const NONE: MatchedVariant = { matched_variant_id: null, matched_variant_value: null, matched_by: null }

/**
 * Qué variante (talla) coincidió. Barcode exacto gana. Con talla en la consulta, la única variante cuyo valor trae esas
 * tallas. Por SKU solo si EXACTAMENTE UNA variante contiene todas las palabras: "21216H" (todas las tallas) no adivina
 * una; "21216H UNICO COLOR XS" sí.
 */
export function matchVariant(variants: readonly SearchableVariant[], p: ParsedSearch): MatchedVariant {
  if (!p.q) return NONE
  if (p.code) {
    const v = variants.find(x => x.barcode !== null && x.barcode === p.code)
    if (v) return { matched_variant_id: v.id, matched_variant_value: v.valor, matched_by: 'barcode' }
  }
  if (p.sizes.length > 0) {
    const bySize = variants.filter(v => p.sizes.every(s => valueHasToken(v.valor, s)))
    if (bySize.length === 1) return { matched_variant_id: bySize[0].id, matched_variant_value: bySize[0].valor, matched_by: 'size' }
  }
  const bySku = variants.filter(v => {
    const sku = v.sku?.toLowerCase()
    return !!sku && (sku.includes(p.q.toLowerCase()) || p.words.every(w => sku.includes(w.toLowerCase())))
  })
  if (bySku.length === 1) return { matched_variant_id: bySku[0].id, matched_variant_value: bySku[0].valor, matched_by: 'sku' }
  return NONE
}
