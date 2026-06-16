import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PmType } from '@prisma/client'

const PostSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.nativeEnum(PmType).default('other'),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const methods = await prisma.paymentMethod.findMany({
    where: { business_id: session.businessId },
    orderBy: { sort_order: 'asc' },
  })

  return NextResponse.json({ ok: true, methods })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const body: unknown = await request.json()

  let data: z.infer<typeof PostSchema>
  try {
    data = PostSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const maxOrder = await prisma.paymentMethod.aggregate({
    where: { business_id: session.businessId },
    _max: { sort_order: true },
  })

  const sort_order = (maxOrder._max.sort_order ?? 0) + 1

  const method = await prisma.paymentMethod.create({
    data: {
      business_id: session.businessId,
      name: data.name,
      type: data.type,
      sort_order,
    },
  })

  return NextResponse.json({ ok: true, method }, { status: 201 })
}
