import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type RouteContext = { params: { id: string } }

const PatchSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(['admin', 'cashier']).optional(),
  is_active: z.boolean().optional(),
})

const USER_SELECT = {
  id: true,
  business_id: true,
  name: true,
  email: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const

async function resolveUser(id: number, businessId: number) {
  return prisma.user.findFirst({ where: { id, business_id: businessId } })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  if (session.userId === id) {
    if (data.role !== undefined) return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 409 })
    if (data.is_active === false) return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 409 })
  }

  const target = await resolveUser(id, session.businessId)
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const user = await prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  })

  return NextResponse.json({ ok: true, user })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  if (session.userId === id) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 409 })

  const target = await resolveUser(id, session.businessId)
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const user = await prisma.user.update({
    where: { id },
    data: { is_active: false },
    select: USER_SELECT,
  })

  return NextResponse.json({ ok: true, user })
}
