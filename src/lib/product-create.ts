import type { prisma } from '@/lib/prisma'
import { createStockAdjustment } from '@/lib/stock-adjust'

type Client = Pick<typeof prisma, 'product' | 'inventoryEntry'>

/**
 * Alta de un producto SIN variantes con su stock inicial (asiento 'adjustment').
 *
 * DEUDA TÉCNICA — duplicación con el importador: src/app/api/products/import-excel/route.ts
 * crea el producto y su asiento de stock en línea, con los mismos campos que aquí. Se dejó sin
 * tocar a propósito (alcance de Alta rápida). Para cerrarla: que el importador llame a esta
 * función dentro de su transacción y verificar con una importación real. Mientras tanto, un
 * cambio en los campos del alta (flags, unidades, stock) debe hacerse en AMBOS sitios.
 */
export interface SimpleProductInput {
  businessId: number
  userId: number
  name: string
  barcode: string
  categoryId: number
  subcategory: string | null
  priceUsd: number
  wholesaleUsd: number | null
  quantity: number
  notes: string
}

export async function createSimpleProduct(client: Client, input: SimpleProductInput): Promise<number> {
  const product = await client.product.create({
    data: {
      business_id:         input.businessId,
      name:                input.name,
      barcode:             input.barcode,
      category_id:         input.categoryId,
      subcategory:         input.subcategory,
      product_type:        'simple',
      sale_mode:           'unit',
      unit_label:          'und',
      base_unit_label:     'und',
      price_per_unit_usd:  input.priceUsd,
      wholesale_price_usd: input.wholesaleUsd,
      has_variants:        false,
      show_in_catalog:     true,
      is_available:        true,
      available_in_pos:    true,
      catalog_visibility:  'visible',
    },
    select: { id: true },
  })
  await createStockAdjustment(client, {
    businessId: input.businessId,
    productId:  product.id,
    userId:     input.userId,
    quantity:   input.quantity,
    notes:      input.notes,
  })
  return product.id
}
