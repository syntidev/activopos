import type { FinancingColumns } from '@/types/financing'

// Datos del pedido que necesita el modal de cobro (subconjunto de la fila del Kanban).
export interface CobrarPedidoItem {
  product_name: string
  quantity:     number | string
  subtotal_usd: number | string
}

/** Datos de envío del pedido: snapshot ship_* (puede venir null) y los campos viejos de respaldo. */
export interface OrderShippingFields {
  client_name?:      string | null
  client_phone?:     string | null
  client_cedula?:    string | null
  recipient_name?:   string | null
  delivery_address?: string | null
  ship_nombre?:      string | null
  ship_cedula?:      string | null
  ship_telefono?:    string | null
  ship_direccion?:   string | null
  /** Método elegido al crear el pedido, congelado en el pedido. */
  ship_metodo_label?: string | null
  /** true = la cédula coincide con un cliente registrado con otro nombre. */
  cedula_alert?:     boolean
}

export interface CobrarPedidoData extends OrderShippingFields, FinancingColumns {
  id:           number
  order_number: string
  client_name:  string | null
  client_phone: string | null
  total_usd:    number | string
  total_bs:     number | string
  rate_used:    number | string
  client_cedula?: string | null
  delivery_type?: string | null
  items:        CobrarPedidoItem[]
}
