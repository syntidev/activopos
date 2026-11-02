/** Fila editable de la tabla de variantes (tallas/colores) del formulario de producto. */
export type VariantTipo = 'talla' | 'color' | 'personalizado'

export interface VariantRow {
  /** Clave estable de React; no viaja al servidor. */
  key: string
  /** Presente solo si la variante ya existe en la DB (edición). */
  id?: number
  valor: string
  tipo: VariantTipo
  /** variant_group: qué tabla de tallas la originó (zap-caballero, ropa-caballero…). */
  group: string | null
  stock: string
  barcode: string
  sku: string
  /** Precio propio Full en USD; vacío = usa el precio del producto. */
  price: string
  /** Precio propio Divisa en USD; vacío = usa el Divisa del producto (solo si la talla no tiene Full propio). */
  divisaPrice: string
  /** Error en línea del código de barras. */
  barcodeError?: string
}

export interface SizeType {
  id: string
  label: string
  hint: string
  tipo: VariantTipo
  group: string | null
  values: readonly string[]
  /** true = el usuario escribe sus propios nombres. */
  custom?: boolean
}
