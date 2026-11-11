import { CARTA_ALLERGEN_LABEL, type CartaAllergen, type CartaTag } from '@/lib/carta/vocab'

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ')


/** Clase CSS de cada etiqueta (picante = rojo, vegetariano = verde, keto = neutro, nuevo = oro, de la casa = acento). */
export const TAG_CLASS: Record<CartaTag, 'tagPicante' | 'tagVeg' | 'tagKeto' | 'tagNuevo' | 'tagCasa'> = {
  picante: 'tagPicante', vegetariano: 'tagVeg', keto: 'tagKeto', nuevo: 'tagNuevo', de_la_casa: 'tagCasa',
}

export const allergenText = (list: readonly CartaAllergen[]): string => list.map(a => CARTA_ALLERGEN_LABEL[a]).join(', ')

/** Formato sellado del proyecto: $11.00 y Bs. 1,234.56 (coma de miles, punto decimal). */
export const fmtUsd = (n: number): string => '$' + n.toFixed(2)
export const fmtBs = (n: number): string => 'Bs. ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtRate = (rate: number): string => rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Sin acentos ni mayúsculas: "maria" encuentra "María" (convención de búsqueda del proyecto). */
export const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase()

/** ¿El plato necesita pasar por la ficha antes de agregarse? (tamaños u opciones obligatorias). */
export const needsFicha = (d: { sizes: unknown[]; groups: { required: boolean }[] }): boolean => d.sizes.length > 0 || d.groups.some(g => g.required)
