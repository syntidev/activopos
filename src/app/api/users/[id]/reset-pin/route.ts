import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Context = { params: { id: string } }

const ResetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'El PIN debe ser exactamente 4 dígitos'),
})

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { pin } = ResetPinSchema.parse(await req.json())

    const target = await prisma.user.findFirst({
      where: { id, business_id: session.businessId },
      select: { id: true, role: true },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const hashed = await bcrypt.hash(pin, 10)
    await prisma.user.update({ where: { id }, data: { password: hashed } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('reset-pin PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
