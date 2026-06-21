import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string; componentId: string } }

const parseId = (raw: string) => {
  const n = parseInt(raw)
  return isNaN(n) ? null : n
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const parentId      = parseId(params.id)
  const componentRecId = parseId(params.componentId)
  if (!parentId || !componentRecId) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const record = await prisma.productComponent.findFirst({
    where: { id: componentRecId, parent_id: parentId, business_id: session.businessId },
  })
  if (!record) return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 })

  await prisma.productComponent.delete({ where: { id: componentRecId } })

  return NextResponse.json({ ok: true })
}
