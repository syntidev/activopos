import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const SYSTEM_CATEGORIES = [
  { name: 'Alquiler',           color: '#6366f1', is_system: true },
  { name: 'Servicios públicos', color: '#0ea5e9', is_system: true },
  { name: 'Nómina',             color: '#f59e0b', is_system: true },
  { name: 'Insumos',            color: '#10b981', is_system: true },
  { name: 'Marketing',          color: '#ec4899', is_system: true },
  { name: 'Otros',              color: '#94a3b8', is_system: true },
] as const

const createSchema = z.object({
  name:  z.string().trim().min(2).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const count = await db.expenseCategory.count() // business_id inyectado
    if (count === 0) {
      // En writes se mantiene business_id explícito (el tipo de createMany lo
      // exige; la capa re-inyecta el mismo valor sin conflicto).
      await db.expenseCategory.createMany({
        data:           SYSTEM_CATEGORIES.map(c => ({ ...c, business_id: session.businessId })),
        skipDuplicates: true,
      })
    }

    const categories = await db.expenseCategory.findMany({
      where: { active: true }, // business_id inyectado por el tenant layer
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true, is_system: true, active: true },
    })

    return NextResponse.json({ ok: true, categories })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const planGate = await checkPlanLimit('access_finanzas')
  if (!planGate.allowed) return planDenied(planGate.reason)

  try {
    const body = createSchema.parse(await req.json())

    const category = await prisma.expenseCategory.create({
      data: {
        business_id: session.businessId,
        name:        body.name,
        color:       body.color ?? null,
      },
      select: { id: true, name: true, color: true, is_system: true, active: true },
    })

    return NextResponse.json({ ok: true, category }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 })
    }
    console.error('finanzas/categorias POST:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
