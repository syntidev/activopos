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

/**
 * Devuelto en USD por producto, imputado a la fecha de la VENTA. Exacto:
 * sale ReturnItem.total_usd, que es el precio real cobrado por esas unidades.
 * NO incluye costo: ReturnItem no lo guarda y joinear sale_items por
 * (sale_id, product_id) es ambiguo (ese par no es único — hay ventas con el
 * mismo producto en 2 líneas por variante). Por eso COGS/margen no se netea
 * acá: ver reporte del Sprint de devoluciones parciales.
 */
export interface ReturnedUnit {
  usd: number
  qty: number
}

export async function returnedByProduct(
  businessId: number,
  from: Date,
  to?: Date,
): Promise<Map<number, ReturnedUnit>> {
  const rows = await prisma.returnItem.findMany({
    where: {
      return: {
        business_id: businessId,
        status:      'approved',
        sale:        { status: { in: [...REALIZED_SALE_STATUSES] }, sold_at: to ? { gte: from, lt: to } : { gte: from } },
      },
    },
    select: { product_id: true, total_usd: true, qty: true },
  })

  const map = new Map<number, ReturnedUnit>()
  for (const r of rows) {
    const prev = map.get(r.product_id) ?? { usd: 0, qty: 0 }
    map.set(r.product_id, { usd: prev.usd + Number(r.total_usd), qty: prev.qty + Number(r.qty) })
  }
  return map
}

/**
 * Devuelto por categoría de producto, con la MISMA clave que usan los reportes
 * (`COALESCE(c.name, 'Sin categoría')`), para poder restarlo del desglose.
 */
export async function returnedByCategory(
  businessId: number,
  from: Date,
  to?: Date,
): Promise<Map<string, ReturnedUnit>> {
  const byProduct = await returnedByProduct(businessId, from, to)
  if (byProduct.size === 0) return new Map()

  const products = await prisma.product.findMany({
    where:  { id: { in: Array.from(byProduct.keys()) } },
    select: { id: true, category: { select: { name: true } } },
  })
  const categoryOf = new Map(products.map(p => [p.id, p.category?.name ?? 'Sin categoría']))

  const map = new Map<string, ReturnedUnit>()
  for (const [productId, v] of Array.from(byProduct.entries())) {
    const key  = categoryOf.get(productId) ?? 'Sin categoría'
    const prev = map.get(key) ?? { usd: 0, qty: 0 }
    map.set(key, { usd: prev.usd + v.usd, qty: prev.qty + v.qty })
  }
  return map
}

// Para agrupar devoluciones por día/semana/hora NO hay helper: cada reporte lo
// hace con una query raw paralela que repite SU MISMO GROUP BY (DATE_FORMAT,
// WEEK(.,1), HOUR(.)). Calcularlo en JS desde un Date obligaría a asumir que el
// timezone de Node y el de MySQL coinciden, y estos reportes mezclan rangos
// construidos en UTC con agrupaciones en hora de servidor.

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
