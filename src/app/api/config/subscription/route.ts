import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const PatchSchema = z.object({
  subscription_expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
}).strict()

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Datos de plan/facturación: solo admin/super_admin. Consumido solo por la tab de Plan,
  // bloqueada al cashier por middleware; este guard cierra el acceso por API directa.
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { subscription_active: true, subscription_expires_at: true },
  })

  if (!business) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const expiresAt = business.subscription_expires_at
  const expiresStr = expiresAt instanceof Date
    ? expiresAt.toISOString().slice(0, 10)
    : (expiresAt ?? null)

  let days_remaining: number | null = null
  if (expiresAt) {
    const now  = new Date()
    now.setHours(0, 0, 0, 0)
    const diff = expiresAt.getTime() - now.getTime()
    days_remaining = Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return NextResponse.json({
    ok:   true,
    plan: {
      subscription_active:     business.subscription_active,
      subscription_expires_at: expiresStr,
      days_remaining,
    },
  })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const updated = await prisma.business.update({
    where:  { id: session.businessId },
    data:   { subscription_expires_at: new Date(body.subscription_expires_at + 'T12:00:00') },
    select: { subscription_active: true, subscription_expires_at: true },
  })

  const expiresAt  = updated.subscription_expires_at
  const expiresStr = expiresAt instanceof Date ? expiresAt.toISOString().slice(0, 10) : null

  return NextResponse.json({
    ok:   true,
    plan: {
      subscription_active:     updated.subscription_active,
      subscription_expires_at: expiresStr,
    },
  })
}
