export interface Supplier {
  id:         number
  name:       string
  rif?:       string
  phone?:     string
  email?:     string
  address?:   string
  notes?:     string
  is_active:  boolean
  created_at: string
}

export interface ProductOption {
  id:                 number
  name:               string
  price_per_unit_usd: number
}
