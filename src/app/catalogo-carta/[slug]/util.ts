import type { CartaTag } from '@/types/carta'

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ')

export const dishHref = (slug: string, id: number): string => '/catalogo-carta/' + slug + '/p/' + id

export const TAG_LABEL: Record<CartaTag, string> = { nuevo: 'Nuevo', popular: 'Popular', promo: 'Promo', recomendado: 'Recomendado' }

export const TAG_CLASS: Record<CartaTag, 'tagNuevo' | 'tagPopular' | 'tagPromo' | 'tagRecomendado'> = {
  nuevo: 'tagNuevo', popular: 'tagPopular', promo: 'tagPromo', recomendado: 'tagRecomendado',
}

export const fmtRate = (rate: number): string => rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Sin acentos ni mayúsculas: "maria" encuentra "María" (convención de búsqueda del proyecto). */
export const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase()
