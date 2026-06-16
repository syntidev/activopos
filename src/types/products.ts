export type SaleMode = 'weight' | 'unit' | 'service'

export interface Category {
  id: number
  business_id: number
  name: string
  color: string | null
  sort_order: number
  active: boolean
}

export interface CategoryWithCount extends Category {
  _count: { products: number }
}

export interface ProductStock {
  quantity: number
  waste: number
  net_qty: number
}

export interface PriceCalculation {
  cost_usd: number
  margin: number
  price_usd: number
  profit_usd: number
  price_bs: number
}

export interface ProductWithStock {
  id: number
  business_id: number
  category_id: number | null
  name: string
  barcode: string | null
  sku: string | null
  description: string | null
  sale_mode: SaleMode
  product_type: string
  base_unit_label: string
  price_per_kg_usd: number | null
  price_per_unit_usd: number | null
  cost_per_unit_usd: number | null
  min_stock: number
  image_path: string | null
  is_favorite: boolean
  active: boolean
  sort_order: number
  category: Category | null
  stock: ProductStock
  price_bs: number | null
  profit_usd: number | null
  is_low_stock: boolean
}

export interface InventoryEntryRecord {
  id: number
  business_id: number
  product_id: number
  quantity: number
  waste: number
  cost_per_unit_usd: number | null
  supplier: string | null
  notes: string | null
  created_by: number
  entered_at: Date
  created_at: Date
}

export interface ImportResult {
  created: number
  errors: Array<{ row: number; message: string }>
}
