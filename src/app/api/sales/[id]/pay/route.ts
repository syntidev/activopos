import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

const paySchema = z.object({
  payments: z
    .array(
      z.object({
        payment_method_id: z.number().int().positive(),
        amount_bs: z.number().positive(),
        amount_usd: z.number().positive(),
        reference: z.string().optional(),
      })
    )
    .min(1),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    const body = paySchema.parse(await req.json())

    // Lectura de validación (fuera del $transaction) → tenant layer
    const sale = await db.sale.findFirst({
      where: { id: saleId }, // business_id inyectado por el tenant layer
      include: {
        items: {
          select: {
            id: true, product_id: true, quantity: true,
            recipe_snapshot: true, variant_id: true,
            product: {
              select: {
                product_type: true,
                components: { select: { component_id: true, quantity: true } },
              },
            },
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    if (sale.status === 'paid') {
      return NextResponse.json({ error: 'La venta ya fue cobrada' }, { status: 409 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta está anulada' }, { status: 409 })
    }

    const rate         = await getBcvRate()
    const totalBs      = Number(sale.total_bs)
    const totalUsd     = Number(sale.total_usd)
    const payTotalBs   = body.payments.reduce((acc, p) => acc + p.amount_bs,  0)
    const payTotalUsd  = body.payments.reduce((acc, p) => acc + p.amount_usd, 0)

    if (payTotalBs < totalBs - 0.01) {
      return NextResponse.json(
        {
          error: `Pago insuficiente. Total: ${totalBs.toFixed(2)} Bs. Recibido: ${payTotalBs.toFixed(2)} Bs`,
        },
        { status: 400 }
      )
    }

    const montoRecibidoUsd = Math.round(payTotalUsd * 100) / 100
    const vueltoUsd        = Math.max(0, Math.round((payTotalUsd - totalUsd) * 100) / 100)

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const updated = await prisma.$transaction(async (tx) => {
      const paidSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status:             'paid',
          sold_at:            new Date(),
          rate_used:          rate,
          monto_recibido_usd: montoRecibidoUsd,
          vuelto_usd:         vueltoUsd,
          payments: {
            create: body.payments.map(p => ({
              payment_method_id: p.payment_method_id,
              amount_bs: p.amount_bs,
              amount_usd: p.amount_usd,
              reference: p.reference,
              rate_used: rate,
            })),
          },
        },
        include: {
          items: true,
          payments: {
            include: {
              payment_method: { select: { id: true, name: true, type: true } },
            },
          },
        },
      })

      const inventoryDeductions: {
        business_id: number
        product_id:  number
        quantity:    number
        waste:       number
        notes:       string
        created_by:  number
      }[] = []

      for (const item of sale.items) {
        const productType = item.product.product_type
        if (productType === 'simple') {
          if (item.variant_id != null) {
            // Variant stock tracked on ProductVariant row
            await tx.productVariant.update({
              where: { id: item.variant_id },
              data:  { stock: { decrement: Number(item.quantity) } },
            })
          } else {
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  item.product_id,
              quantity:    -Number(item.quantity),
              waste:       0,
              notes:       `VENTA #${sale.ticket_number}`,
              created_by:  session.userId,
            })
          }
        } else {
          // SEC-02: use snapshot captured at sale creation — immune to recipe changes
          const components: { component_id: number; quantity: number }[] =
            item.recipe_snapshot
              ? (JSON.parse(item.recipe_snapshot) as { component_id: number; quantity: number }[])
              : item.product.components

          for (const comp of components) {
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  comp.component_id,
              quantity:    -(Number(item.quantity) * comp.quantity),
              waste:       0,
              notes:       `VENTA #${sale.ticket_number} (componente)`,
              created_by:  session.userId,
            })
          }
        }
      }

      if (inventoryDeductions.length > 0) {
        await tx.inventoryEntry.createMany({ data: inventoryDeductions })
      }

      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id: session.userId,
          action: 'sale_paid',
          model_type: 'Sale',
          model_id: saleId,
          new_values: {
            ticket_number: sale.ticket_number,
            total_bs: totalBs,
            rate,
          },
        },
      })

      return paidSale
    })

    return NextResponse.json({ ok: true, sale: updated })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error(`sales/${saleId}/pay error:`, err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
