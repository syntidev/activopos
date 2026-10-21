/** Alta rápida de productos sin variantes en /captura-etiquetas. */

export type TitleSource =
  | 'label_captures'
  | 'open_products_facts'
  | 'open_food_facts'
  | 'upcitemdb'
  | 'vision'

export interface TitleHit {
  title: string
  source: TitleSource
}

export interface QuickAddCategory {
  id: number
  name: string
}

export interface QuickAddContext {
  rate: number
  categories: QuickAddCategory[]
  subcategories: string[]
}

/** Producto del negocio que ya usa ese código de barras. */
export interface QuickAddExisting {
  id: number
  name: string
  barcode: string
  stock: number
  price_usd: number | null
  wholesale_usd: number | null
  /** Con variantes el stock vive en cada variante: Alta rápida no puede sumarle cantidad. */
  has_variants: boolean
}

export interface QuickAddLookup {
  existing: QuickAddExisting | null
  title: TitleHit | null
}

export interface QuickAddCreateBody {
  code: string
  name: string
  quantity: number
  category_id: number
  subcategory?: string | null
  price_usd: number
  wholesale_usd?: number | null
}

/** Cada campo viaja solo si cambió. quantity_delta puede ser negativo (corrección). */
export interface QuickAddPatchBody {
  quantity_delta?: number
  price_usd?: number
  wholesale_usd?: number | null
}

export interface QuickAddProductResult {
  id: number
  name: string
  barcode: string
  stock: number
  price_usd: number | null
  wholesale_usd: number | null
  has_variants: boolean
  /** Solo en el lookup: la talla cuyo barcode o SKU coincidió (el código era de una variante). */
  matched_variant_id?: number | null
  matched_variant_value?: string | null
}

/** Fila de la lista de la sesión (lo insertado o sumado desde esta pestaña). */
export interface QuickAddedItem extends QuickAddProductResult {
  /** 'created' = alta nueva; 'restocked' = solo se sumó cantidad a uno existente. */
  kind: 'created' | 'restocked'
  /** Unidades que esta pestaña ha ingresado en total. */
  added: number
}
