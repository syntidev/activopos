import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_CATEGORIES = 200

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_CATEGORIES),
}).refine(d => new Set(d.ids).size === d.ids.length, { message: 'ids repetidos', path: ['ids'] })

// Reordena en lote: sort_order = posición en `ids`. Todo o nada: si algún id no
// es del negocio de la sesión no se cambia nada. Ruta estática: Next la resuelve
// antes que /api/categories/[id].
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const { ids } = reorderSchema.parse(await req.json())

    const owned = await prisma.category.count({
      where: { id: { in: ids }, business_id: session.businessId },
    })
    if (owned !== ids.length) {
      return NextResponse.json({ error: 'Categorías no válidas para este negocio' }, { status: 404 })
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.category.updateMany({
          where: { id, business_id: session.businessId },
          data:  { sort_order: index },
        }),
      ),
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Category reorder error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
