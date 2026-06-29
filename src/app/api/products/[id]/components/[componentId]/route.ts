import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string; componentId: string } }

const parseId = (raw: string) => {
  const n = parseInt(raw)
  return isNaN(n) ? null : n
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const parentId      = parseId(params.id)
    const componentRecId = parseId(params.componentId)
    if (!parentId || !componentRecId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const record = await db.productComponent.findFirst({
      where: { id: componentRecId, parent_id: parentId }, // business_id inyectado por el tenant layer
    })
    if (!record) return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 })

    await db.productComponent.delete({ where: { id: componentRecId } }) // business_id inyectado

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
