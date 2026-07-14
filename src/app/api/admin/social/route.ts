import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Tope duro: el historial es una grilla de miniaturas, no un archivo paginado.
// Si algún día pasa de esto, toca paginación de verdad — hoy sería especulativo.
const LIMIT = 60

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const posts = await prisma.socialPost.findMany({
    orderBy: { created_at: 'desc' },
    take:    LIMIT,
    include: { assets: { orderBy: { orden: 'asc' } } },
  })

  return NextResponse.json({ ok: true, posts })
}
