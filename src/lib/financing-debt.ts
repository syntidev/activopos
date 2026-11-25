import type { Prisma } from '@prisma/client'
import { REALIZED_SALE_STATUSES } from '@/lib/sales-returns'

/**
 * Deuda de un financiamiento (Cashea) RECHAZADO/retirado DESPUÉS de cobrar: el saldo asignado a la financiadora nunca entró y pasa
 * a ser deuda del cliente. La venta original ya contó todo el ingreso (status paid/partial_return), así que cobrarla NO crea otra
 * venta ni otro ingreso: es un SaleAbono sobre la venta ORIGINAL (reduce la deuda; solo el efectivo mueve el efectivo esperado).
 * La línea de pago Cashea queda como está (pendiente): sin movimientos contables nuevos.
 */

const r2 = (x: number): number => Math.round(x * 100) / 100
const REALIZED: readonly string[] = REALIZED_SALE_STATUSES

export const DEBT_ORDER_SELECT = {
  id: true, order_number: true, client_id: true, client_name: true, client_phone: true,
  sale: {
    select: {
      id: true, ticket_number: true, status: true, created_at: true, sold_at: true, client_id: true, client_name: true,
      client: { select: { id: true, name: true, phone: true } },
      payments: { select: { amount_usd: true, payment_method: { select: { is_financing: true } } } },
      abonos:   { select: { amount_usd: true } },
    },
  },
} satisfies Prisma.OrderSelect

type DebtOrder = Prisma.OrderGetPayload<{ select: typeof DEBT_ORDER_SELECT }>

export interface FinancingDebt {
  order_id: number; order_number: string; sale_id: number; ticket_number: string
  client_id: number | null; client_name: string | null; client_phone: string | null
  created_at: Date
  /** Lo asignado a la financiadora (la deuda original). */
  asignado_usd: number
  abonado_usd:  number
  saldo_usd:    number
}

function toDebt(o: DebtOrder): FinancingDebt | null {
  const s = o.sale
  if (!s || !REALIZED.includes(s.status)) return null
  const asignado = r2(s.payments.filter(p => p.payment_method.is_financing).reduce((a, p) => a + Number(p.amount_usd), 0))
  if (asignado <= 0) return null
  const abonado = Math.min(asignado, r2(s.abonos.reduce((a, x) => a + Number(x.amount_usd), 0)))
  return {
    order_id: o.id, order_number: o.order_number, sale_id: s.id, ticket_number: s.ticket_number,
    client_id: s.client_id ?? o.client_id, client_name: s.client?.name ?? s.client_name ?? o.client_name, client_phone: s.client?.phone ?? o.client_phone,
    created_at: s.sold_at ?? s.created_at, asignado_usd: asignado, abonado_usd: abonado, saldo_usd: r2(asignado - abonado),
  }
}

/** Deudas de financiamiento rechazado con saldo > 0 del negocio. business_id explícito (sirve dentro de un $transaction). */
export async function listFinancingDebts(db: Pick<Prisma.TransactionClient, 'order'>, businessId: number): Promise<FinancingDebt[]> {
  const rows = await db.order.findMany({
    where: { business_id: businessId, financing_status: 'rejected', sale_id: { not: null } }, select: DEBT_ORDER_SELECT, orderBy: { id: 'asc' },
  })
  return rows.map(toDebt).filter((d): d is FinancingDebt => d !== null && d.saldo_usd > 0)
}

/** Deuda de UNA venta (null si la venta no tiene deuda de financiamiento). */
export async function financingDebtOfSale(db: Pick<Prisma.TransactionClient, 'order'>, businessId: number, saleId: number): Promise<FinancingDebt | null> {
  const o = await db.order.findFirst({ where: { business_id: businessId, sale_id: saleId, financing_status: 'rejected' }, select: DEBT_ORDER_SELECT })
  return o ? toDebt(o) : null
}

export class DebtPaymentError extends Error {
  constructor(readonly status: number, message: string, readonly code: string, readonly extra: Record<string, unknown> = {}) { super(message) }
}

export interface DebtPaymentInput { payment_method_id: number; amount_usd: number; rate: number; notes?: string | null; cashRegisterId?: number | null }

/**
 * Registra el pago de la deuda como SaleAbono de la venta ORIGINAL. Dentro de un $transaction: cierra la fila de la venta (FOR UPDATE),
 * re-lee la deuda y valida método (activo, del negocio, NO financiador) y monto ≤ saldo. No toca el status de la venta ni crea ventas.
 */
export async function payFinancingDebtTx(
  tx: Prisma.TransactionClient, ctx: { businessId: number; userId: number }, saleId: number, input: DebtPaymentInput,
): Promise<{ abono_id: number; saldo_usd: number; pagada: boolean }> {
  await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} AND business_id = ${ctx.businessId} FOR UPDATE`
  const debt = await financingDebtOfSale(tx, ctx.businessId, saleId)
  if (!debt || debt.saldo_usd <= 0) throw new DebtPaymentError(409, 'Esta venta no tiene deuda de financiamiento pendiente.', 'NO_DEBT')

  const method = await tx.paymentMethod.findFirst({ where: { id: input.payment_method_id, business_id: ctx.businessId, is_active: true }, select: { id: true, is_financing: true } })
  if (!method || method.is_financing) {
    throw new DebtPaymentError(422, 'Cobra la deuda con un método de pago real y activo del negocio (no el financiador).', 'INVALID_METHOD')
  }
  const monto = r2(input.amount_usd)
  if (monto > debt.saldo_usd + 0.005) {
    throw new DebtPaymentError(422, `El monto ($${monto.toFixed(2)}) supera la deuda ($${debt.saldo_usd.toFixed(2)}).`, 'AMOUNT_EXCEEDS_DEBT', { saldo_usd: debt.saldo_usd })
  }

  const abono = await tx.saleAbono.create({
    data: {
      sale_id: saleId, payment_method_id: method.id, cash_register_id: input.cashRegisterId ?? null,
      amount_usd: monto, amount_bs: r2(monto * input.rate), rate_used: input.rate, notes: input.notes ?? null, created_by: ctx.userId,
    },
    select: { id: true },
  })
  const saldo = r2(debt.saldo_usd - monto)
  await tx.activityLog.create({
    data: {
      business_id: ctx.businessId, user_id: ctx.userId, action: 'financing_debt_paid', model_type: 'Order', model_id: debt.order_id,
      reason: 'Cobro de la deuda de financiamiento rechazado', old_values: { saldo_usd: debt.saldo_usd }, new_values: { abono_id: abono.id, amount_usd: monto, saldo_usd: saldo },
    },
  })
  return { abono_id: abono.id, saldo_usd: saldo, pagada: saldo <= 0.005 }
}
