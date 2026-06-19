import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const ret = await prisma.return.findFirst({
    where:   { id, business_id: session.businessId },
    include: { items: true },
  })
  if (!ret) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
  if (ret.status !== 'pending') {
    return NextResponse.json({ error: 'Solo se pueden aprobar devoluciones pendientes' }, { status: 409 })
  }

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.return.update({
      where: { id },
      data:  { status: 'approved' },
    })

    if (ret.restores_stock) {
      await tx.inventoryEntry.createMany({
        data: ret.items.map(item => ({
          business_id:      session.businessId,
          product_id:       item.product_id,
          quantity:         Number(item.qty),
          created_by:       session.userId,
          notes:            `Devolución #${id}`,
        })),
      })
    }

    return result
  })

  return NextResponse.json({ ok: true, return: { ...updated, total_usd: Number(updated.total_usd), total_bs: Number(updated.total_bs) } })
}
