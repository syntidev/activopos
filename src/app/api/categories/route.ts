import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const categorySchema = z.object({
  name:                 z.string().min(1).max(80),
  color:                z.string().regex(HEX_COLOR).nullable().optional(),
  // Opcional: sin valor, el servidor asigna MAX(sort_order)+1 del negocio (al final).
  sort_order:           z.number().int().optional(),
  requires_preparation: z.boolean().optional(),
})

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const categories = await db.category.findMany({
      where: { active: true }, // business_id inyectado por el tenant layer
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ ok: true, categories })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!['admin', 'super_admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = categorySchema.parse(body)

    let sortOrder = data.sort_order
    if (sortOrder === undefined) {
      const last = await prisma.category.aggregate({
        where: { business_id: session.businessId },
        _max:  { sort_order: true },
      })
      sortOrder = (last._max.sort_order ?? -1) + 1
    }

    const category = await prisma.category.create({
      data: { business_id: session.businessId, ...data, sort_order: sortOrder },
    })

    return NextResponse.json({ ok: true, category }, { status: 201 })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Category create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
