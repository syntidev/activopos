export interface Supplier {
  id:                   number
  name:                 string
  rif?:                 string
  phone?:               string
  email?:               string
  address?:             string
  notes?:               string
  is_active:            boolean
  created_at:           string
  total_purchases_usd?: number
}

export interface ProductOption {
  id:                 number
  name:               string
  price_per_unit_usd: number
}

export interface PurchaseItem {
  id:         number
  product_id: number
  product:    ProductOption
  qty:        number
  cost_usd:   number
}

export interface Purchase {
  id:          number
  supplier_id: number
  supplier:    Supplier
  reference?:  string
  notes?:      string
  status:      'received' | 'pending' | 'cancelled'
  total_usd:   number
  created_at:  string
  items:       PurchaseItem[]
}

// CLI-A: sin /api/suppliers todavía — el directorio y las compras viven en
// estado local separado por página, así que este filtro/select de compras
// necesita su propia lista. Se reemplaza por un fetch compartido en cuanto exista.
export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 101, name: 'Distribuidora La Central', rif: 'J-12345678-9', phone: '0414-1234567', is_active: true, created_at: new Date(2026, 5, 1).toISOString(), total_purchases_usd: 0 },
  { id: 102, name: 'Mayorista XYZ',            rif: 'V-98765432-1', phone: '0212-9876543',  is_active: true, created_at: new Date(2026, 5, 5).toISOString(), total_purchases_usd: 0 },
]

// CLI-A: sin /api/suppliers ni /api/purchases todavía — catálogo de productos mock
// hasta que el modal de compra pueda buscar contra /api/products real.
export const MOCK_PRODUCTS: ProductOption[] = [
  { id: 1, name: 'Arroz 1kg',       price_per_unit_usd: 0.85 },
  { id: 2, name: 'Aceite 1L',       price_per_unit_usd: 1.20 },
  { id: 3, name: 'Harina PAN 1kg',  price_per_unit_usd: 0.95 },
  { id: 4, name: 'Azúcar 1kg',      price_per_unit_usd: 0.75 },
  { id: 5, name: 'Café 500g',       price_per_unit_usd: 3.50 },
  { id: 6, name: 'Pasta 500g',      price_per_unit_usd: 0.65 },
]
