import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.expenseCategory.findFirst({
    where: { id, business_id: session.businessId },
  })
  if (!existing) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })

  try {
    const body = patchSchema.parse(await req.json())

    // Protect system "Otros" from deactivation
    if (body.active === false && existing.is_system && existing.name === 'Otros') {
      return NextResponse.json({ error: 'La categoría "Otros" no puede desactivarse' }, { status: 409 })
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data:  {
        ...(body.name   !== undefined ? { name: body.name }     : {}),
        ...(body.color  !== undefined ? { color: body.color }   : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      select: { id: true, name: true, color: true, is_system: true, active: true },
    })

    return NextResponse.json({ ok: true, category: updated })
  } catch (err) {
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
