import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const voidSchema = z.object({
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden anular ventas' },
      { status: 403 }
    )
  }

  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = voidSchema.parse(await req.json())

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, business_id: session.businessId },
      include: { items: true },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta ya está anulada' }, { status: 409 })
    }

    const wasPaid = sale.status === 'paid'

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'cancelled' },
      })

      if (wasPaid) {
        await tx.inventoryEntry.createMany({
          data: sale.items.map(item => ({
            business_id: session.businessId,
            product_id: item.product_id,
            quantity: Number(item.quantity),
            waste: 0,
            notes: `ANULACION #${sale.ticket_number}`,
            created_by: session.userId,
          })),
        })
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
