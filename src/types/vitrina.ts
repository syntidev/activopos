/** Contexto "vitrina de marca": catálogo premium acotado a una sola marca de un negocio. */
export interface VitrinaContext {
  /** Ruta de la vitrina (/catalogo-premium/{slug}/marca/{marca}): destino de logo, Inicio y "volver". */
  href:       string
  /** Marca normalizada (brandSlug): parámetro de contexto ?vitrina= de la ficha de producto. */
  marca:      string
  brandName:  string
  brandImage: string | null
}
