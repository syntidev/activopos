import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') {
    return NextResponse.json({ error: 'Solo administradores pueden marcar pagos' }, { status: 403 })
  }

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const gasto = await prisma.gasto.findFirst({
    where: { id, business_id: session.businessId, is_paid: false },
  })
  if (!gasto) {
    return NextResponse.json({ error: 'Gasto no encontrado o ya pagado' }, { status: 404 })
  }

  const updated = await prisma.gasto.update({
    where: { id },
    data:  { is_paid: true, paid_at: new Date() },
  })

  return NextResponse.json({ ok: true, gasto: { ...updated, monto_usd: Number(updated.monto_usd) } })
}
