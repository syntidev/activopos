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
    where:  { id, business_id: session.businessId },
    select: { id: true, status: true },
  })
  if (!ret) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
  if (ret.status !== 'pending') {
    return NextResponse.json({ error: 'Solo se pueden rechazar devoluciones pendientes' }, { status: 409 })
  }

  const updated = await prisma.return.update({
    where: { id },
    data:  { status: 'rejected' },
  })

  return NextResponse.json({ ok: true, return: { ...updated, total_usd: Number(updated.total_usd), total_bs: Number(updated.total_bs) } })
}
