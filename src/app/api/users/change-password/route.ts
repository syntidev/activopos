import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare, hash } from 'bcryptjs'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const schema = z.object({
  current_password: z.string().min(1, 'La contraseña actual es requerida'),
  new_password:     z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
})

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    let body: z.infer<typeof schema>
    try {
      body = schema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
    }

    if (body.current_password === body.new_password) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      )
    }

    const user = await db.user.findFirst({
      where:  { id: session.userId }, // business_id inyectado por el tenant layer
      select: { id: true, password: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const isValid = await compare(body.current_password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    const hashed = await hash(body.new_password, 12)
    await db.user.update({
      where: { id: session.userId }, // business_id inyectado por el tenant layer
      data:  { password: hashed },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
