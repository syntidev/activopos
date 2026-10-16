// Datos del pedido que necesita el modal de cobro (subconjunto de la fila del Kanban).
export interface CobrarPedidoItem {
  product_name: string
  quantity:     number | string
  subtotal_usd: number | string
}

export interface CobrarPedidoData {
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
