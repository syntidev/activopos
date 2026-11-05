/** Vocabulario cerrado de la Carta (C2): lo que se guarda en products.carta_tags y products.allergens. */

export const CARTA_TAGS = ['picante', 'vegetariano', 'keto', 'nuevo', 'de_la_casa'] as const
export type CartaTag = (typeof CARTA_TAGS)[number]

export const CARTA_TAG_LABEL: Record<CartaTag, string> = {
  picante: 'Picante', vegetariano: 'Vegetariano', keto: 'Keto', nuevo: 'Nuevo', de_la_casa: 'De la casa',
}

export const CARTA_ALLERGENS = ['gluten', 'lacteos', 'huevo', 'frutos_secos', 'mariscos', 'pescado', 'soya', 'mani'] as const
export type CartaAllergen = (typeof CARTA_ALLERGENS)[number]

export const CARTA_ALLERGEN_LABEL: Record<CartaAllergen, string> = {
  gluten: 'gluten', lacteos: 'lácteos', huevo: 'huevo', frutos_secos: 'frutos secos', mariscos: 'mariscos', pescado: 'pescado', soya: 'soya', mani: 'maní',
}

const pick = <T extends string>(list: readonly T[], raw: unknown): T[] => (Array.isArray(raw) ? list.filter(x => raw.includes(x)) : [])

/** Lee el JSON de la base y descarta lo que no esté en el vocabulario (orden estable). */
export const readTags = (raw: unknown): CartaTag[] => pick(CARTA_TAGS, raw)
export const readAllergens = (raw: unknown): CartaAllergen[] => pick(CARTA_ALLERGENS, raw)
