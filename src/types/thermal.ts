// Contrato de datos de la impresión térmica (QZ Tray + ESC/POS).

export type ThermalPaper = '58mm' | '80mm'

// Config POR EQUIPO (localStorage): la impresora está físicamente en una
// máquina, no en el negocio. Guardarla en la DB haría que el terminal B
// intentara imprimir en la impresora del terminal A.
export interface ThermalSettings {
  enabled: boolean
  printer: string | null
  paper:   ThermalPaper
}

// Flags de qué se imprime -- los mismos ticket_show_* del negocio que ya usa
// la ruta HTML /api/sales/[id]/ticket, con el nombre corto del panel.
export interface ThermalTicketFlags {
  show_description:    boolean
  show_bs:             boolean
  show_foreign:        boolean
  foreign_format:      'usd' | 'ref'
  show_address:        boolean
  show_phone:          boolean
  show_customer_data:  boolean
  show_rif:            boolean
  show_cashier_name:   boolean
  show_bcv_rate:       boolean
  show_payment_method: boolean
}

export interface ThermalTicketItem {
  name:               string
  variant_label:      string | null
  description:        string | null
  quantity:           number
  price_per_unit_usd: number
  subtotal_usd:       number
  subtotal_bs:        number
  discount_usd:       number
}

export interface ThermalTicketData {
  business: {
    name:    string
    rif:     string | null
    address: string | null
    phone:   string | null
    footer:  string | null
  }
  flags: ThermalTicketFlags
  sale: {
    ticket_number: string
    sold_at:       string | null
    cashier_name:  string
    client_name:   string | null
    client_phone:  string | null
    total_usd:     number
    total_bs:      number
    rate:          number
    items:         ThermalTicketItem[]
    payments:      { method: string; amount_usd: number }[]
  }
}

export type ThermalPrintResult =
  | { state: 'skipped' }
  | { state: 'printed'; printer: string }
  | { state: 'error'; message: string }
