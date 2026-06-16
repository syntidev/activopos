import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type RouteContext = { params: { id: string } }

const PatchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

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

  const existing = await prisma.paymentMethod.findFirst({
    where: { id, business_id: session.businessId },
  })

  if (!existing) return NextResponse.json({ error: 'Método no encontrado' }, { status: 404 })

  const method = await prisma.paymentMethod.update({
    where: { id },
    data,
  })

  return NextResponse.json({ ok: true, method })
}
