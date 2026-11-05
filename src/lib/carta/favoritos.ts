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
