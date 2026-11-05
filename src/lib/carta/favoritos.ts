import { prisma } from '@/lib/prisma'

/** Ventas que cuentan como "vendido": pagadas y con devolución parcial (la total deja de contar; ver estándar contable). */
const SOLD_STATUSES = ['paid', 'partial_return'] as const

/** Ids de producto más vendidos del negocio (unidades en sale_items de ventas pagadas) en los últimos `days` días. SOLO LECTURA. */
export async function topSellerIds(businessId: number, limit: number, days = 30): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
  const rows = await prisma.saleItem.groupBy({
    by:      ['product_id'],
    where:   { sale: { business_id: businessId, status: { in: [...SOLD_STATUSES] }, created_at: { gte: since } } },
    _sum:    { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take:    limit,
  })
  return rows.map(r => r.product_id)
}

/**
 * "También te puede gustar": los platos que más se piden JUNTOS con este (mismas ventas pagadas, últimos `days` días). SOLO LECTURA.
 * La interfaz completa con la misma categoría cuando no hay suficiente historial.
 */
export async function relatedIds(businessId: number, productId: number, limit: number, days = 90): Promise<number[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
  const rows = await prisma.$queryRaw<{ product_id: number; n: bigint }[]>`
    SELECT other.product_id AS product_id, COUNT(*) AS n
    FROM sale_items mine
    JOIN sales s ON s.id = mine.sale_id
    JOIN sale_items other ON other.sale_id = mine.sale_id AND other.product_id <> mine.product_id
    WHERE mine.product_id = ${productId} AND s.business_id = ${businessId}
      AND s.status IN ('paid', 'partial_return') AND s.created_at >= ${since}
    GROUP BY other.product_id
    ORDER BY n DESC, other.product_id ASC
    LIMIT ${limit}`
  return rows.map(r => r.product_id)
}
