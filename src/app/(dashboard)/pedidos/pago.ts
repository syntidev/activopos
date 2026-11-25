import type { OrderPago, PagoEstado } from '@/lib/order-payment'

/** Tipos y etiquetas del estado de pago de un pedido (la API ya lo deriva: aquí solo se muestra). */
export type { OrderPago, PagoEstado }

export const PAGO_LABEL: Record<PagoEstado, string> = {
  por_cobrar: 'Por cobrar',
  cobrado:    'Cobrado',
  a_credito:  'A crédito',
}

/** Campos de pago que añaden GET /api/orders y GET /api/orders/[id]. */
export interface PedidoPagoFields {
  pago_estado?: PagoEstado
  pago?:        OrderPago
}

/** Resumen del cliente enlazado (solo en el detalle: GET /api/orders/[id] → order.client; null si el pedido no tiene cliente). */
export interface PedidoClienteResumen {
  id:                       number
  name:                     string
  cedula:                   string | null
  phone:                    string | null
  address:                  string | null
  price_tier:               string
  pedidos_previos:          number
  saldo_cxc_usd:            number
  deuda_financiamiento_usd: number
  saldo_por_cobrar_usd:     number
}

/** Cuerpo de error de las rutas de pedidos: el mensaje viaja en español y se muestra tal cual. */
export interface ApiErrorBody {
  error?: string
  code?:  string
  field?: string
}

export const TIER_LABEL: Record<string, string> = { detal: 'Detal', mayorista: 'Mayorista' }
