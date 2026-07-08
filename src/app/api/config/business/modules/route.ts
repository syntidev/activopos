import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'

const ALLOWED_MODULES = [
  'pos', 'inventory', 'caja', 'pedidos', 'catalog',
  'finanzas', 'reportes', 'analytics', 'kds', 'delivery',
] as const

// core modules are always active — matches TabModulos.tsx alwaysOn:true.
// Todo lo demás (caja, pedidos, catalog, finanzas, reportes, analytics) es
// desactivable; forzarlos aquí pisaba el toggle del usuario en cada guardado.
const CORE_MODULES = ['pos', 'inventory'] as const

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
    select: { modules_enabled: true, catalog_plan: true },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const modules_enabled = (business.modules_enabled ?? '')
    .split(',')
    .filter(Boolean)

  // El catálogo digital, además del toggle, requiere plan pro/business.
  // Sidebar lo usa para ocultar el módulo aunque esté "activado" en modules_enabled.
  const plan = (business.catalog_plan as PlanTier | null) ?? 'trial'
  const catalog_plan_allows = PLAN_LIMITS[plan]?.catalog ?? false

  return NextResponse.json({
    ok:              true,
    modules_enabled,
    allowed_modules: ALLOWED_MODULES,
    core_modules:    CORE_MODULES,
    catalog_plan_allows,
  })
}
