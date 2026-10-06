import { prisma } from './prisma'

// Una venta con devolución PARCIAL sigue siendo una venta: el dinero entró y
// solo volvió a salir la porción devuelta. Antes TODO el repo filtraba
// `status: 'paid'` a secas, así que devolver 1 unidad de 4 sacaba la venta
// ENTERA de caja y de los reportes (bug confirmado 2026-10-06: devolver $10 de
// una venta de $40 bajaba el efectivo esperado en $40).
//
// 'returned' (devolución TOTAL) queda fuera a propósito: de esa venta no quedó
// nada, su monto completo debe desaparecer.
//
// En $queryRaw va como literal: `AND s.status IN ('paid','partial_return')`
// (una lista no se interpola como parámetro).
export const REALIZED_SALE_STATUSES = ['paid', 'partial_return'] as const

export interface ReturnedTotals {
  usd: number
  bs:  number
}

// Solo devoluciones APROBADAS mueven dinero. Las 'pending'/'rejected' no.
// Además se exige que la venta siga en REALIZED_SALE_STATUSES: si la venta
// quedó 'returned' (devolución total) su monto ya salió completo del lado de
// las ventas, restar la devolución encima la contaría dos veces.
async function sumApprovedReturns(
  businessId: number,
  anchor: 'refund_date' | 'sale_date',
  from: Date,
  to?: Date,
): Promise<ReturnedTotals> {
  const range = to ? { gte: from, lt: to } : { gte: from }

  const agg = await prisma.return.aggregate({
    where: {
      business_id: businessId,
      status:      'approved',
      ...(anchor === 'refund_date'
        ? { created_at: range, sale: { status: { in: [...REALIZED_SALE_STATUSES] } } }
        : { sale: { status: { in: [...REALIZED_SALE_STATUSES] }, sold_at: range } }),
    },
    _sum: { total_usd: true, total_bs: true },
  })

  return {
    usd: Number(agg._sum.total_usd ?? 0),
    bs:  Number(agg._sum.total_bs  ?? 0),
  }
}

/**
 * Devoluciones imputadas al PERÍODO DE LA VENTA — para ingreso/reporte neto.
 * El ingreso pertenece al día en que se vendió, neto de lo que se devolvió de
 * esa venta (aunque la devolución se haya procesado después).
 */
export function returnedTotalsBySaleDate(businessId: number, from: Date, to?: Date): Promise<ReturnedTotals> {
  return sumApprovedReturns(businessId, 'sale_date', from, to)
}

/**
 * Devoluciones imputadas a CUÁNDO SE REEMBOLSÓ — para el cajón.
 * Se ancla en `created_at` de la devolución, no en la fecha de la venta:
 * devolver hoy una venta de ayer deja CORTO el cajón de HOY, no el de ayer.
 *
 * Decisión de Carlos 2026-10-06: mientras `Return` no tenga método de
 * reembolso, se asume que TODO reembolso salió en efectivo del cajón (se resta
 * 1:1 de `cashVentasBs`), sin importar cómo se pagó la venta original. Si algún
 * día se registra el método real, este es el único lugar que cambia.
 */
export function cashRefundTotals(businessId: number, from: Date, to?: Date): Promise<ReturnedTotals> {
  return sumApprovedReturns(businessId, 'refund_date', from, to)
}

export interface ApprovedReturnRow {
  /** Cuándo se reembolsó — para imputarlo al turno de caja correcto. */
  refunded_at: Date
  /** Cuándo se vendió lo devuelto — para imputar el ingreso neto al período de la venta. */
  sold_at:     Date | null
  total_usd:   number
  total_bs:    number
}

/**
 * Lista plana de devoluciones aprobadas del rango, para repartirlas en memoria
 * entre varios turnos/días. Una sola query: nunca llamar cashRefundTotals()
 * dentro de un loop (N+1 que .doc/AGENTS.md prohíbe).
 */
export async function approvedReturnsInRange(
  businessId: number,
  from: Date,
  to?: Date,
): Promise<ApprovedReturnRow[]> {
  const rows = await prisma.return.findMany({
    where: {
      business_id: businessId,
      status:      'approved',
      created_at:  to ? { gte: from, lte: to } : { gte: from },
      sale:        { status: { in: [...REALIZED_SALE_STATUSES] } },
    },
    select: {
      created_at: true,
      total_usd:  true,
      total_bs:   true,
      sale:       { select: { sold_at: true } },
    },
  })

  return rows.map(r => ({
    refunded_at: r.created_at,
    sold_at:     r.sale.sold_at,
    total_usd:   Number(r.total_usd),
    total_bs:    Number(r.total_bs),
  }))
}
