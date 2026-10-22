/** Financiamiento (Cashea) declarado en un ticket. Contrato: .doc/CONTRATO_CASHEA_TICKET.md */
export type FinancingStatus = 'requested' | 'approved' | 'rejected'

export type FinancingAction = 'request' | 'approve' | 'reject' | 'reopen' | 'clear'

export type PaymentKind = 'cashea' | 'bs' | 'divisa'

export interface TicketFinancing {
  status: FinancingStatus
  status_label: string
  provider: string | null
  phrase: string | null
}

/** Producto del ticket que impide el financiamiento (409 con `blocked_products`). */
export interface BlockedProduct {
  id: number
  name: string
}

/** Columnas de financiamiento tal como llegan en filas de ventas, borradores y pedidos. */
export interface FinancingColumns {
  financing_status?: string | null
  financing_provider?: string | null
  financing_phrase?: string | null
}

export interface FinancingActionResult {
  ok: boolean
  financing: TicketFinancing | null
  error?: string
  blocked_products?: BlockedProduct[]
}
