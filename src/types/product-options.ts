/** Grupos de opciones de un producto (plantilla Carta: "Tocineta: Pavo / Cochino", "Extras", …). Forma de GET/PUT /api/products/[id]/options. */

export interface ProductOptionDTO {
  /** Ausente = opción nueva. */
  id?:             number
  name:            string
  /** Extra en USD que suma al precio del plato (0 = sin costo). */
  price_extra_usd: number
  is_active:       boolean
}

export interface ProductOptionGroupDTO {
  /** Ausente = grupo nuevo. */
  id?:        number
  name:       string
  /** El cliente debe elegir al menos una. */
  required:   boolean
  /** true = varias opciones; false = una sola. */
  multiple:   boolean
  /** Tope de opciones elegibles (solo con `multiple`); null = sin tope. */
  max_select: number | null
  is_active:  boolean
  /** El orden del arreglo ES el orden de la pantalla (sort_order se deriva en el servidor). */
  options:    ProductOptionDTO[]
}

export interface ProductOptionsResponse {
  ok:     true
  groups: ProductOptionGroupDTO[]
}
