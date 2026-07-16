import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw, 10)
  return isNaN(id) || id <= 0 ? null : id
}

// Hard delete, mismo criterio ya usado en calendar/[id]/route.ts (contenido no
// financiero). SocialAsset cascada por el FK del schema; SocialCalendarEntry se
// desvincula primero (ver nota en route.ts del borrado múltiple).
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.socialPost.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.socialCalendarEntry.updateMany({
    where: { social_post_id: id },
    data:  { social_post_id: null },
  })
  await prisma.socialPost.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
