import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const count = await prisma.expenseCategory.count({ where: { business_id: session.businessId } })
  if (count === 0) {
    await prisma.expenseCategory.createMany({
      data:           SYSTEM_CATEGORIES.map(c => ({ ...c, business_id: session.businessId })),
      skipDuplicates: true,
    })
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { business_id: session.businessId, active: true },
    orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true, is_system: true, active: true },
  })

  return NextResponse.json({ ok: true, categories })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

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
