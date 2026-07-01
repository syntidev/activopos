import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (session.role !== 'super_admin') return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { session }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperAdmin()
  if (guard.error) return guard.error

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const business = await prisma.business.findUnique({
    where:  { id },
    select: {
      id:           true,
      name:         true,
      city:         true,
      segment:      true,
      catalog_slug: true,
      catalog_plan: true,
      active:       true,
      created_at:   true,
      _count:       { select: { products: true, users: true, orders: true } },
    },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const [salesMonth, recentActivity] = await Promise.all([
    prisma.sale.count({ where: { business_id: id, status: 'paid', sold_at: { gte: monthStart } } }),
    prisma.activityLog.findMany({
      where:   { business_id: id },
      orderBy: { created_at: 'desc' },
      take:    15,
      select:  { id: true, action: true, model_type: true, created_at: true, user: { select: { name: true } } },
    }),
  ])

  return NextResponse.json({ ok: true, business, salesMonth, recentActivity })
}

const PatchSchema = z.object({
  active: z.boolean().optional(),
  plan:   z.enum(['trial', 'starter', 'pro']).optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperAdmin()
  if (guard.error) return guard.error

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const business = await prisma.business.update({
    where: { id },
    data: {
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.plan !== undefined ? { catalog_plan: data.plan } : {}),
    },
    select: { id: true, active: true, catalog_plan: true },
  })

  return NextResponse.json({ ok: true, business })
}
