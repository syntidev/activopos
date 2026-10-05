import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { z } from 'zod'

const patchSchema = z.object({
  name:   z.string().trim().min(2).max(80).optional(),
  color:  z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const existing = await db.expenseCategory.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

    const body = patchSchema.parse(await req.json())

    // P2 2026-10-05 (auditoría CLI-C): solo protegía "Otros" por nombre exacto,
    // además de is_system -- las otras categorías de sistema (is_system=true,
    // name distinto de "Otros") se podían desactivar por API directa. is_system
    // ya es la marca real de "categoría de sistema" (no hay otro campo para
    // esto) -- se usa sola, sin el nombre extra.
    if (body.active === false && existing.is_system) {
      return NextResponse.json({ error: `La categoría "${existing.name}" es del sistema y no puede desactivarse` }, { status: 409 })
    }

    const updated = await db.expenseCategory.update({
      where: { id }, // business_id inyectado por el tenant layer
      data:  {
        ...(body.name   !== undefined ? { name: body.name }     : {}),
        ...(body.color  !== undefined ? { color: body.color }   : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      select: { id: true, name: true, color: true, is_system: true, active: true },
    })

    return NextResponse.json({ ok: true, category: updated })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 })
    }
    console.error('finanzas/categorias/[id] PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
