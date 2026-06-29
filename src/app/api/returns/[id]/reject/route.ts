import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type Context = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: Context) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const ret = await db.return.findFirst({
      where:  { id }, // business_id inyectado por el tenant layer
      select: { id: true, status: true },
    })
    if (!ret) return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
    if (ret.status !== 'pending') {
      return NextResponse.json({ error: 'Solo se pueden rechazar devoluciones pendientes' }, { status: 409 })
    }

    const updated = await db.return.update({
      where: { id }, // business_id inyectado por el tenant layer
      data:  { status: 'rejected' },
    })

    return NextResponse.json({ ok: true, return: { ...updated, total_usd: Number(updated.total_usd), total_bs: Number(updated.total_bs) } })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
