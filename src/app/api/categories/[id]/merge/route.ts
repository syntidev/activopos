import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { deletedCategoryName } from '@/lib/categories'

const mergeSchema = z.object({ target_id: z.number().int().positive() })

class CategoryNotFoundError extends Error {}

type RouteContext = { params: { id: string } }

// Fusiona la categoría :id en target_id: mueve TODOS sus productos (activos o no, para no
// dejar ninguno colgando de una categoría inactiva) y desactiva el origen con el mismo
// borrado suave del DELETE. Todo o nada. business_id sale SIEMPRE de la sesión.
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { session } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const sourceId = Number(params.id)
    if (!Number.isInteger(sourceId) || sourceId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const { target_id: targetId } = mergeSchema.parse(await req.json())
    if (targetId === sourceId) {
      return NextResponse.json({ error: 'El destino debe ser otra categoría' }, { status: 400 })
    }

    const businessId = session.businessId
    // Validación y movimiento en la misma transacción: si otro request desactiva el origen
    // o el destino entre medias, no se mueve nada.
    const moved = await prisma.$transaction(async tx => {
      const target = await tx.category.count({ where: { id: targetId, business_id: businessId, active: true } })
      const origin = await tx.category.findFirst({
        where:  { id: sourceId, business_id: businessId, active: true },
        select: { name: true },
      })
      if (target !== 1 || !origin) throw new CategoryNotFoundError()
      // Renombrar libera el nombre para poder crear otra categoría igual (unique business_id+name).
      const source = await tx.category.updateMany({
        where: { id: sourceId, business_id: businessId, active: true },
        data:  { active: false, name: deletedCategoryName(origin.name, sourceId) },
      })
      if (source.count !== 1) throw new CategoryNotFoundError()
      const { count } = await tx.product.updateMany({
        where: { category_id: sourceId, business_id: businessId },
        data:  { category_id: targetId },
      })
      return count
    })

    return NextResponse.json({ ok: true, moved })
  } catch (err) {
    if (err instanceof CategoryNotFoundError) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Category merge error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
