import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = paySchema.parse(await req.json())

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, business_id: session.businessId },
      include: {
        items: {
          include: {
            product: {
              select: {
                product_type: true,
                components: {
                  select: { component_id: true, quantity: true },
                },
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

    const rate = await getBcvRate()
    const totalBs = Number(sale.total_bs)
    const payTotal = body.payments.reduce((acc, p) => acc + p.amount_bs, 0)

    if (payTotal < totalBs - 0.01) {
      return NextResponse.json(
        {
          error: `Pago insuficiente. Total: ${totalBs.toFixed(2)} Bs. Recibido: ${payTotal.toFixed(2)} Bs`,
        },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const paidSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'paid',
          sold_at: new Date(),
          rate_used: rate,
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
          inventoryDeductions.push({
            business_id: session.businessId,
            product_id:  item.product_id,
            quantity:    -Number(item.quantity),
            waste:       0,
            notes:       `VENTA #${sale.ticket_number}`,
            created_by:  session.userId,
          })
        } else {
          for (const comp of item.product.components) {
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

      await tx.inventoryEntry.createMany({ data: inventoryDeductions })

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
