import { z } from 'zod'

export const draftItemSchema = z.object({
  product_id:   z.number().int().positive(),
  quantity:     z.number().positive(),
  variant_id:   z.number().int().positive().optional(),
  discount_usd: z.number().min(0).default(0),
})

export type DraftItem = z.infer<typeof draftItemSchema>
