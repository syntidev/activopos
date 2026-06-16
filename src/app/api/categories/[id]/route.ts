import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(20).nullable().optional(),
  sort_order: z.number().int().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    const existing = await prisma.category.findFirst({
      where: { id, business_id: session.businessId },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const category = await prisma.category.update({ where: { id }, data })
    return NextResponse.json({ ok: true, category })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Category patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await prisma.category.findFirst({
    where: { id, business_id: session.businessId },
  })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const activeCount = await prisma.product.count({
    where: { category_id: id, active: true },
  })
  if (activeCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${activeCount} producto(s) activo(s)` },
      { status: 409 }
    )
  }

  await prisma.category.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
