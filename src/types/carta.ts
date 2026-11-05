/** Tipos de la plantilla Carta (catalogo-carta). Datos ya serializados: nada de Decimal ni Date. */
import type { CartaAllergen, CartaTag } from '@/lib/carta/vocab'

export interface CartaSize {
  id:       number
  label:    string
  priceUsd: number
  soldOut:  boolean
}

export interface CartaOption {
  id:            number
  name:          string
  priceExtraUsd: number
}

/** Grupo de opciones de un plato ("Proteína: pavo | cochino"). required = hay que elegir; multiple = varias (maxSelect las limita). */
export interface CartaOptionGroup {
  id:        number
  name:      string
  required:  boolean
  multiple:  boolean
  maxSelect: number | null
  options:   CartaOption[]
}

export interface CartaDish {
  id:           number
  name:         string
  description:  string | null
  image:        string | null
  categoryName: string | null
  /** Precio de lista en USD (con tamaños: el menor; "Consultar precio" = 0). */
  priceUsd:     number
  priceBs:      number | null
  /** Precio Divisa ya validado por divisaPriceOf; null si no aplica o el negocio no cobra en Divisa. */
  divisaUsd:    number | null
  sizes:        CartaSize[]
  groups:       CartaOptionGroup[]
  tags:         CartaTag[]
  allergens:    CartaAllergen[]
  isFeatured:   boolean
  /** Sin existencias. */
  outOfStock:   boolean
  /** Agotado del día (se limpia solo al cambiar el día de negocio de Caracas). */
  soldOutToday: boolean
  /** catalog_visibility = on_request: sin precio ni botón de agregar ("Consultar precio"), igual que el premium. */
  onRequest:    boolean
}

export interface CartaCategory {
  name:   string
  /** Nombre en minúsculas, sin acentos y con guiones: lo usan los data-testid (carta-tab-{slug}). */
  slug:   string
  dishes: CartaDish[]
}

export interface CartaHeroSlide {
  key:      string
  image:    string | null
  title:    string
  subtitle: string | null
  /** Plato del hero (modo favoritos): muestra precio y "Agregar". */
  dish:     CartaDish | null
  /** CTA propio de un slide configurado en landing_sections. */
  cta:      { text: string; href: string } | null
  dark:     boolean
}

export interface CartaHero {
  /** 'slides' = event_slider del negocio; 'dishes' = favoritos o recomendados; 'none' = sin hero. */
  kind:    'slides' | 'dishes' | 'none'
  kicker:  string
  slides:  CartaHeroSlide[]
}

/** "Cómo pagas", según el panel de cobro del negocio. */
export interface CartaPagos {
  divisa:  string[]
  bs:      boolean
  cashea:  boolean
}

export interface CartaPayOption {
  kind:   'divisa' | 'bs' | 'cashea'
  label:  string
  /** Nombre del método de pago del negocio que viaja en el pedido. */
  method: string
}

export interface CartaOpenState {
  open:  boolean
  label: string
}

export interface CartaHorarioDia {
  day:  string
  text: string
}
