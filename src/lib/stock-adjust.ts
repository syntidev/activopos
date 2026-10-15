import { prisma } from '@/lib/prisma'

type Client = Pick<typeof prisma, 'inventoryEntry'>

interface AdjustmentInput {
  businessId:   number
  productId:    number
  userId:       number
  quantity:     number
  notes:        string
  costPerUnit?: number | null
  supplier?:    string | null
}

/** Existencia neta (entradas − merma) — misma fórmula que GET /api/products/[id]. */
export async function getNetStock(client: Client, businessId: number, productId: number): Promise<number> {
  const agg = await client.inventoryEntry.aggregate({
    where: { business_id: businessId, product_id: productId },
    _sum:  { quantity: true, waste: true },
  })
  return Number(agg._sum.quantity ?? 0) - Number(agg._sum.waste ?? 0)
}

/** Único punto que escribe un movimiento de ajuste: modal "Ajustar stock" y edición de producto. */
export function createStockAdjustment(client: Client, input: AdjustmentInput) {
  return client.inventoryEntry.create({
    data: {
      business_id:       input.businessId,
      product_id:        input.productId,
      quantity:          input.quantity,
      waste:             0,
      entry_type:        'adjustment',
      cost_per_unit_usd: input.costPerUnit ?? null,
      supplier:          input.supplier ?? null,
      notes:             input.notes,
      created_by:        input.userId,
    },
    select: {
      id: true,
      quantity: true,
      waste: true,
      cost_per_unit_usd: true,
      notes: true,
      entered_at: true,
    },
  })
}
