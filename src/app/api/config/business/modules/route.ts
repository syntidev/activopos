import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_MODULES = [
  'pos', 'inventory', 'caja', 'pedidos', 'catalog',
  'finanzas', 'reportes', 'analytics', 'kds', 'delivery',
] as const

// core modules are always active — optional-only: kds, delivery
const CORE_MODULES = [
  'pos', 'inventory', 'caja', 'pedidos',
  'catalog', 'finanzas', 'reportes', 'analytics',
] as const

const modulesSchema = z.object({
  modules: z.array(z.enum(ALLOWED_MODULES)).min(1),
})

/* ── PATCH /api/config/business/modules — update enabled modules ── */

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = modulesSchema.parse(await req.json())

    // Always include core modules — merge silently, never return error for missing core
    const modules = Array.from(new Set([...CORE_MODULES, ...body.modules]))

    const business = await prisma.business.update({
      where: { id: session.businessId },
      data:  { modules_enabled: modules.join(',') },
      select: { id: true, modules_enabled: true },
    })

    return NextResponse.json({
      ok:              true,
      modules_enabled: (business.modules_enabled ?? '').split(',').filter(Boolean),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Módulos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('modules PATCH:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/* ── GET /api/config/business/modules — read enabled modules ── */

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { modules_enabled: true },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const modules_enabled = (business.modules_enabled ?? '')
    .split(',')
    .filter(Boolean)

  return NextResponse.json({
    ok:              true,
    modules_enabled,
    allowed_modules: ALLOWED_MODULES,
    core_modules:    CORE_MODULES,
  })
}
