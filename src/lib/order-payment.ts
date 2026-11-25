import type { Prisma } from '@prisma/client'
import { REALIZED_SALE_STATUSES } from '@/lib/sales-returns'

/**
 * Estado de pago de un PEDIDO, DERIVADO (sin columna): sale la venta enlazada (orders.sale_id) y sus líneas de pago.
 * El método de pago es solo registro; Cashea NO es compuerta de aprobación: ActivoPOS registra (a) la inicial que entró con un
 * método real y (b) el saldo asignado a Cashea (línea de pago con un método `is_financing`). Por decisión de Carlos el saldo
 * asignado a Cashea CUENTA como cobrado para despachar.
 *
 *   por_cobrar  sin venta, o financiamiento rechazado/retirado tras cobrar (el saldo de Cashea es deuda del cliente)
 *   cobrado     venta realizada (paid/partial_return): inicial recibida + saldo asignado a Cashea
 *   a_credito   venta a crédito (status 'credit', saldo = total − abonos)
 * Contabilidad intacta: aquí no se mueve ningún monto, solo se lee lo ya registrado.
 */

export type PagoEstado = 'por_cobrar' | 'cobrado' | 'a_credito'

export interface OrderPago {
  pago_estado:         PagoEstado
  total_usd:           number
  /** Cobrado con métodos reales (efectivo, transferencia…). */
  recibido_usd:        number
  /** Saldo asignado a Cashea (financiadora) y que aún no pagó Cashea: cuenta como cobrado. */
  cashea_asignado_usd: number
  /** Saldo que quedó a cargo del cliente tras rechazar/retirar el financiamiento ya cobrado. */
  deuda_cliente_usd:   number
  /** Lo que falta por cobrar: sin cobrar = total; a crédito = total − abonos; rechazado = la deuda. */
  saldo_pendiente_usd: number
  /** true = el pedido puede despacharse/entregarse sin autorización extra (cobrado, a crédito o con saldo de financiamiento rechazado). */
  puede_avanzar:       boolean
  /** true = puede despacharse: puede_avanzar, o el cliente del pedido tiene crédito autorizado (aunque aún no se haya cerrado a crédito). Entregar sigue exigiendo puede_avanzar. */
  puede_despachar:     boolean
}

/** include de Prisma que necesita derivePago (venta enlazada con sus pagos y abonos). */
export const ORDER_PAGO_INCLUDE = {
  sale: {
    select: {
      status: true, total_usd: true,
      payments: { select: { amount_usd: true, payment_method: { select: { is_financing: true } } } },
      abonos:   { select: { amount_usd: true } },
    },
  },
} satisfies Prisma.OrderInclude

export interface PagoSource {
  total_usd:        unknown
  financing_status: string | null
  sale: {
    status:    string
    total_usd: unknown
    payments:  { amount_usd: unknown; payment_method: { is_financing: boolean } }[]
    abonos:    { amount_usd: unknown }[]
  } | null
}

const r2 = (x: number): number => Math.round(x * 100) / 100
const sum = (xs: readonly { amount_usd: unknown }[]): number => r2(xs.reduce((a, x) => a + Number(x.amount_usd), 0))
// Solo lo realizado cuenta como cobrado. Una venta 'returned' (devolución total) ya reembolsó todo: NO es cobrado ni deja avanzar el pedido.
const COBRADAS: readonly string[] = REALIZED_SALE_STATUSES

/** creditoAutorizado = el cliente enlazado (del MISMO negocio) tiene credit_authorized: habilita despachar sin cobrar ni cerrar a crédito. */
export function derivePago(o: PagoSource, creditoAutorizado = false): OrderPago {
  const p = derive(o)
  return { ...p, puede_despachar: p.puede_avanzar || creditoAutorizado }
}

function derive(o: PagoSource): OrderPago {
  const total = r2(Number(o.total_usd))
  const base: OrderPago = { pago_estado: 'por_cobrar', total_usd: total, recibido_usd: 0, cashea_asignado_usd: 0, deuda_cliente_usd: 0, saldo_pendiente_usd: total, puede_avanzar: false, puede_despachar: false }
  const s = o.sale
  if (!s) return base

  if (s.status === 'credit') {
    const saldo = Math.max(0, r2(Number(s.total_usd) - sum(s.abonos)))
    return { ...base, pago_estado: 'a_credito', saldo_pendiente_usd: saldo, puede_avanzar: true }
  }
  if (!COBRADAS.includes(s.status)) return base

  const cashea = sum(s.payments.filter(p => p.payment_method.is_financing))
  const recibido = sum(s.payments.filter(p => !p.payment_method.is_financing))
  if (o.financing_status === 'rejected' && cashea > 0) {
    // Financiamiento rechazado/retirado después de cobrar: lo asignado a Cashea pasa a ser deuda del cliente. Sin bloquear etapas.
    return { ...base, recibido_usd: recibido, deuda_cliente_usd: cashea, saldo_pendiente_usd: cashea, puede_avanzar: true }
  }
  return { ...base, pago_estado: 'cobrado', recibido_usd: recibido, cashea_asignado_usd: cashea, saldo_pendiente_usd: 0, puede_avanzar: true }
}
