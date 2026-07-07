import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

const voidSchema = z.object({
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()

    if (session.role !== 'admin' && session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo administradores pueden anular ventas' },
        { status: 403 }
      )
    }

    const body = voidSchema.parse(await req.json())

    // Lectura de validación (fuera del $transaction) → tenant layer
    const sale = await db.sale.findFirst({
      where: { id: saleId }, // business_id inyectado por el tenant layer
      include: { items: true },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta ya está anulada' }, { status: 409 })
    }

    const wasPaid = sale.status === 'paid'

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'cancelled' },
      })

      if (wasPaid) {
        const variantItems = sale.items.filter(i => i.variant_id != null)
        const productItems = sale.items.filter(i => i.variant_id == null)

        for (const item of variantItems) {
          await tx.productVariant.update({
            where: { id: item.variant_id! },
            data:  { stock: { increment: Number(item.quantity) } },
          })
        }

        if (productItems.length > 0) {
          await tx.inventoryEntry.createMany({
            data: productItems.map(item => ({
              business_id: session.businessId,
              product_id: item.product_id,
              quantity: Number(item.quantity),
              waste: 0,
              entry_type: 'void_reversal',
              notes: `ANULACION #${sale.ticket_number}`,
              created_by: session.userId,
            })),
          })
        }
      }

      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id: session.userId,
          action: 'sale_void',
          model_type: 'Sale',
          model_id: saleId,
          reason: body.reason,
          old_values: {
            status: sale.status,
            total_bs: Number(sale.total_bs),
            ticket_number: sale.ticket_number,
          },
          new_values: { status: 'cancelled' },
        },
      })
    })

    return NextResponse.json({ ok: true, message: 'Venta anulada correctamente' })
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
    console.error(`sales/${saleId}/void error:`, err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
