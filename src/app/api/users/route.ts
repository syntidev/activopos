import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const PostSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  role: z.enum(['admin', 'cashier']),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const users = await prisma.user.findMany({
    where: { business_id: session.businessId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      business_id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  })

  return NextResponse.json({ ok: true, users })
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

  const duplicate = await prisma.user.findUnique({
    where: { business_id_email: { business_id: session.businessId, email: data.email } },
  })

  if (duplicate) return NextResponse.json({ error: 'Email ya registrado en este negocio' }, { status: 409 })

  const hashed = await bcrypt.hash(data.password, 10)

  const user = await prisma.user.create({
    data: {
      business_id: session.businessId,
      name: data.name,
      email: data.email,
      password: hashed,
      role: data.role,
    },
    select: {
      id: true,
      business_id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  })

  return NextResponse.json({ ok: true, user }, { status: 201 })
}
