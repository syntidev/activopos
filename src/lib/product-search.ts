import type { Prisma } from '@prisma/client'

/**
 * Búsqueda ÚNICA de productos (Productos, POS cámara/texto/pistola, catálogo público y Alta rápida).
 * Un solo input busca a la vez en: nombre, barcode del producto, SKU del producto, "Ref" en la descripción,
 * SKU de variante (contiene) y barcode de variante (EXACTO). Varias palabras = AND entre palabras, OR entre campos.
 * Solo construye filtros y calcula la variante que coincidió; business_id lo pone quien llama (sesión o slug).
 */

export const SEARCH_MAX_CHARS = 60
export const SEARCH_MAX_WORDS = 5
/** Un barcode exacto necesita señal suficiente: con menos de 4 caracteres solo se busca por texto. */
export const MIN_CODE_CHARS = 4

export interface ParsedSearch {
  /** Texto limpio (sin controles, espacios colapsados, ≤ 60 caracteres). '' si no hay búsqueda. */
  q:     string
  /** Palabras para nombre/descripción/SKU (máx. 5). El prefijo suelto "Ref"/"Ref:" no cuenta como palabra. */
  words: string[]
  /** Posible barcode exacto: el texto sin espacios si son solo dígitos (4+), o un token alfanumérico sin espacios. */
  code:  string | null
}

export function parseSearch(raw: string | null | undefined): ParsedSearch {
  const q = (raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_CHARS)
  if (!q) return { q: '', words: [], code: null }
  let words = q.split(' ').slice(0, SEARCH_MAX_WORDS)
  const sinRef = words.filter(w => !/^ref:?$/i.test(w))
  if (sinRef.length > 0) words = sinRef
  const compact = q.replace(/\s+/g, '')
  const code = /^\d+$/.test(compact) && compact.length >= MIN_CODE_CHARS
    ? compact
    : !/\s/.test(q) && /^[A-Za-z0-9._-]+$/.test(q) && q.length >= MIN_CODE_CHARS ? q : null
  return { q, words, code }
}

/** Filtro de Prisma para Product (sin business_id: lo inyecta la capa de tenant o lo agrega quien llama). */
export function productSearchWhere(p: ParsedSearch): Prisma.ProductWhereInput | null {
  if (!p.q) return null
  const word = (w: string): Prisma.ProductWhereInput => ({
    OR: [
      { name:        { contains: w } },
      { sku:         { contains: w } },
      { barcode:     { contains: w } },
      { description: { contains: w } },   // "Ref: 11953H" vive en la descripción
      { variants:    { some: { is_active: true, sku: { contains: w } } } },
    ],
  })
  const or: Prisma.ProductWhereInput[] = [
    { AND: p.words.map(word) },
    // La frase completa contra un SKU que lleva espacios ("21216H UNICO COLOR XS")
    { sku: { contains: p.q } },
    { variants: { some: { is_active: true, sku: { contains: p.q } } } },
  ]
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
  matched_by:            'barcode' | 'sku' | null
}

const NONE: MatchedVariant = { matched_variant_id: null, matched_variant_value: null, matched_by: null }

/**
 * Qué variante (talla) coincidió. Barcode exacto gana. Por SKU solo si EXACTAMENTE UNA variante contiene todas las
 * palabras: "21216H" (todas las tallas) no adivina una; "21216H UNICO COLOR XS" sí.
 */
export function matchVariant(variants: readonly SearchableVariant[], p: ParsedSearch): MatchedVariant {
  if (!p.q) return NONE
  if (p.code) {
    const v = variants.find(x => x.barcode !== null && x.barcode === p.code)
    if (v) return { matched_variant_id: v.id, matched_variant_value: v.valor, matched_by: 'barcode' }
  }
  const bySku = variants.filter(v => {
    const sku = v.sku?.toLowerCase()
    return !!sku && (sku.includes(p.q.toLowerCase()) || p.words.every(w => sku.includes(w.toLowerCase())))
  })
  if (bySku.length === 1) return { matched_variant_id: bySku[0].id, matched_variant_value: bySku[0].valor, matched_by: 'sku' }
  return NONE
}
