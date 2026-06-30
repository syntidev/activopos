export type { SessionPayload as SessionUser } from '@/lib/auth'

export interface BusinessSettings {
  pin?: string
  ticket_format?: 'carta' | '80mm' | '58mm'
  ticket_currency?: 'both' | 'usd' | 'bs'
  hide_rate?: boolean
}

export type UserRole = 'super_admin' | 'admin' | 'cashier'

export interface ClientRecord {
  id: number
  name: string
  cedula: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: Date
  pending_balance_usd: number
}

export interface SaleHistoryItem {
  id: number
  ticket_number: string
  status: 'quote' | 'pending' | 'paid' | 'cancelled' | 'draft' | 'returned' | 'credit'
  total_usd: number
  total_bs: number
  rate_used: number
  sold_at: Date | null
  created_at: Date
  abonos: Array<{ id: number; amount_usd: number; created_at: Date; notes: string | null }>
  balance_remaining: number
}

export interface ClientHistory {
  client: { id: number; name: string; cedula: string | null; phone: string | null; pending_balance_usd: number }
  sales: SaleHistoryItem[]
}

export interface PaymentMethod {
  id:   number
  name: string
  type: string
}

export interface ClientHistoryData extends ClientHistory {
  paymentMethods: PaymentMethod[]
}

export interface AbonoTarget {
  saleId:       number
  ticketNumber: string
  maxAmount:    number
}

export interface AbonoForm {
  amount_usd:        string
  payment_method_id: string
  reference:         string
  notes:             string
}

export interface BusinessConfig {
  id:                          number
  name:                        string
  legal_name:                  string | null
  rif:                         string | null
  logo_path:                   string | null
  address:                     string | null
  city:                        string | null
  state:                       string | null
  phone:                       string | null
  email:                       string | null
  theme:                       string
  theme_color:                 string
  rate_source:                 string
  current_rate:                number
  allow_cashier_price_override: boolean
}

export interface TicketConfig {
  ticket_prefix:   string
  ticket_footer:   string | null
  ticket_format:   'carta' | '80mm' | '58mm'
  ticket_currency: 'both' | 'usd' | 'bs'
  hide_rate:       boolean
}

export interface PaymentMethodRecord {
  id:          number
  business_id: number
  name:        string
  type:        string
  is_active:   boolean
  sort_order:  number
}

export interface ProductVariant {
  id:           number
  product_id:   number
  tipo:         'talla' | 'color' | 'personalizado'
  valor:        string
  sku:          string | null
  precio_extra: number
  stock:        number
  color_hex:    string | null
  is_active:    boolean
  sort_order:   number
  created_at:   string
}

export interface IvaConfig {
  iva_enabled: boolean
  iva_pct:     number
}

export interface CatalogConfig {
  catalog_plan: string | null
  catalog_slug: string | null
}

export interface UserRecord {
  id:         number
  name:       string
  email:      string | null
  role:       UserRole
  is_active:  boolean
  created_at: string
}
