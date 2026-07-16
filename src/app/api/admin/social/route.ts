import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SocialPostStatus } from '@prisma/client'

// Tope duro: el historial es una grilla de miniaturas, no un archivo paginado.
// Si algún día pasa de esto, toca paginación de verdad — hoy sería especulativo.
const LIMIT = 60

const VALID_ESTADOS: SocialPostStatus[] = ['pendiente', 'generado', 'publicado', 'error']

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const estadoParam = req.nextUrl.searchParams.get('estado')
  const estado = VALID_ESTADOS.find(e => e === estadoParam)

  const posts = await prisma.socialPost.findMany({
    where:   estado ? { estado } : undefined,
    orderBy: { created_at: 'desc' },
    take:    LIMIT,
    include: { assets: { orderBy: { orden: 'asc' } } },
  })

  return NextResponse.json({ ok: true, posts })
}

// Borrado múltiple ("Borrar seleccionados") -- body: { ids: number[] }. Hard delete,
// mismo criterio ya usado hoy en calendar/[id]/route.ts (contenido no financiero).
// SocialAsset cascada solo por el FK (onDelete: Cascade en el schema); SocialCalendarEntry
// referencia social_post_id SIN cascade -- se desvincula primero (no se borra la entrada
// del calendario, solo pierde el post generado que tenía asociado) para que el delete no
// reviente contra esa FK.
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const raw = (body as { ids?: unknown })?.ids
  const ids = Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n) && n > 0) : []
  if (ids.length === 0) return NextResponse.json({ error: 'ids requerido (array de enteros)' }, { status: 400 })

  await prisma.socialCalendarEntry.updateMany({
    where: { social_post_id: { in: ids } },
    data:  { social_post_id: null },
  })
  const result = await prisma.socialPost.deleteMany({ where: { id: { in: ids } } })

  return NextResponse.json({ ok: true, deleted: result.count })
}
