import type { Prisma } from '@prisma/client'
import { ORDER_PAGO_INCLUDE, derivePago } from '@/lib/order-payment'

type Db = Pick<Prisma.TransactionClient, 'sale' | 'order'>
const r2 = (x: number): number => Math.round(x * 100) / 100

export interface ClientDebt {
  /** Ventas a crédito (status 'credit'): total − abonos. */
  saldo_cxc_usd:            number
  /** Saldo asignado a Cashea de pedidos ya cobrados cuyo financiamiento fue rechazado/retirado (deuda del cliente). */
  deuda_financiamiento_usd: number
  saldo_por_cobrar_usd:     number
}

/** Saldo por cobrar de un cliente. business_id explícito: sirve igual dentro de un $transaction (prisma base). */
export async function clientDebt(db: Db, businessId: number, clientId: number): Promise<ClientDebt> {
  const [credito, rechazados] = await Promise.all([
    db.sale.findMany({ where: { business_id: businessId, client_id: clientId, status: 'credit' }, select: { total_usd: true, abonos: { select: { amount_usd: true } } } }),
    db.order.findMany({ where: { business_id: businessId, client_id: clientId, financing_status: 'rejected', sale_id: { not: null } }, select: { total_usd: true, financing_status: true, ...ORDER_PAGO_INCLUDE } }),
  ])
  const cxc = r2(credito.reduce((a, s) => a + Math.max(0, Number(s.total_usd) - s.abonos.reduce((x, ab) => x + Number(ab.amount_usd), 0)), 0))
  const fin = r2(rechazados.reduce((a, o) => a + derivePago(o).deuda_cliente_usd, 0))
  return { saldo_cxc_usd: cxc, deuda_financiamiento_usd: fin, saldo_por_cobrar_usd: r2(cxc + fin) }
}
