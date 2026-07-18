import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

const PatchSchema = z.object({
  plan:       z.enum(['gratis', 'negocio_activo']),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido').nullable().optional(),
  status:     z.enum(['active', 'expired', 'suspended']),
})

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const existing = await prisma.business.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  // subscription_active es la única bandera on/off en DB — 'suspended' la apaga, cualquier otro status la deja activa
  // ('trial'/'expired' son estados derivados de catalog_plan/subscription_expires_at, no algo que se fuerce aparte)
  const business = await prisma.business.update({
    where: { id },
    data: {
      catalog_plan:        data.plan,
      subscription_active: data.status !== 'suspended',
      ...(data.expires_at !== undefined
        ? { subscription_expires_at: data.expires_at ? new Date(`${data.expires_at}T12:00:00`) : null }
        : {}),
    },
    select: { id: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
  })

  return NextResponse.json({
    ok: true,
    business: {
      ...business,
      subscription_expires_at: business.subscription_expires_at
        ? business.subscription_expires_at.toISOString().slice(0, 10)
        : null,
    },
  })
}
