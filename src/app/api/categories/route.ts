import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const categorySchema = z.object({
  name:       z.string().min(1).max(80),
  color:      z.string().regex(HEX_COLOR).nullable().optional(),
  sort_order: z.number().int().default(0),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const categories = await prisma.category.findMany({
    where: { business_id: session.businessId, active: true },
    include: {
      _count: { select: { products: { where: { active: true } } } },
    },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ ok: true, categories })
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

    const category = await prisma.category.create({
      data: { business_id: session.businessId, ...data },
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
