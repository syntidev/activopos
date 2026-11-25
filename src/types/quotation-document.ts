/** Entrada del documento único de cotización (POS, módulo /cotizaciones y Ventas). Solo USD. */

export interface QuotationDocBusiness {
  name: string
  rif?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  /** URL ABSOLUTA: el documento se abre como blob: y no resuelve rutas relativas. */
  logoUrl?: string | null
  /** Pie configurado por el negocio (quotation_footer). */
  footer?: string | null
}

export interface QuotationDocLine {
  description: string
  qty: number
  saleMode: 'unit' | 'weight'
  unitPriceUsd: number
  /** Solo para rotular "(desc. X%)"; el total ya viene con el descuento aplicado. */
  discountPct?: number
  totalUsd: number
}

/** Forma mínima de una cotización del módulo (también la del editor sin guardar). */
export interface QuotationDocSource {
  number?: string | null
  created_at?: string | null
  valid_until: string | null
  notes: string | null
  client: { name: string } | null
  total_usd: number
  items: Array<{ name: string; qty: number; price_usd: number; discount_pct?: number | null }>
}

/** Forma mínima de una Sale status 'quote' tal como la lista Ventas. */
export interface SaleDocSource {
  ticket_number: string
  created_at: string
  notes: string | null
  client_name: string | null
  client: { name: string } | null
  cashier: { name: string } | null
  total_usd: number
  items: Array<{
    product_name: string
    quantity: number
    price_per_unit_usd: number
    subtotal_usd: number
    discount_usd: number
    unit_label: string | null
  }>
}

export interface QuotationDocData {
  business: QuotationDocBusiness
  /** Sin número se rotula "Borrador (sin número)". */
  number?: string | null
  issuedAt: Date
  /** YYYY-MM-DD; null = vigencia no guardada (se omite "Válida hasta"). */
  validUntilYmd?: string | null
  attendedBy: string
  clientName?: string | null
  notes?: string | null
  lines: QuotationDocLine[]
  /** Total que traía la fuente; si difiere de la suma de líneas se registra, pero se imprime la suma. */
  sourceTotalUsd?: number | null
}
