import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const PostSchema = z.object({
  name:     z.string().min(2).max(255),
  email:    z.string().email().max(255),
  password: z.string().min(6).max(72).optional(),
  pin:      z.string().regex(/^\d{4}$/).optional(),
  role:     z.enum(['admin', 'cashier']),
}).refine(d => d.password ?? d.pin, { message: 'password o pin requerido' })

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

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const users = await db.user.findMany({
      // business_id inyectado por el tenant layer
      orderBy: { name: 'asc' },
      select: USER_SELECT,
    })

    return NextResponse.json({ ok: true, users })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(request: Request) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body: unknown = await request.json()

    let data: z.infer<typeof PostSchema>
    try {
      data = PostSchema.parse(body)
    } catch (err) {
      if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      throw err
    }

    // Límite de 5 cajeros activos por negocio
    if (data.role === 'cashier') {
      const cashierCount = await db.user.count({
        where: { role: 'cashier', is_active: true }, // business_id inyectado
      })
      if (cashierCount >= 5) {
        return NextResponse.json({ error: 'Límite de 5 cajeros activos alcanzado' }, { status: 422 })
      }
    }

    const duplicate = await db.user.findUnique({
      where: { business_id_email: { business_id: session.businessId, email: data.email } },
    })

    if (duplicate) return NextResponse.json({ error: 'Email ya registrado en este negocio' }, { status: 409 })

    const credential = data.password ?? data.pin ?? ''
    const hashed = await bcrypt.hash(credential, 10)

    const user = await db.user.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name:        data.name,
        email:       data.email,
        password:    hashed,
        role:        data.role,
      },
      select: USER_SELECT,
    })

    return NextResponse.json({ ok: true, user }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
