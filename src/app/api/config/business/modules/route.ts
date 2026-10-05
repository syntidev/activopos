import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLAN_LIMITS, PLAN_DISPLAY, type PlanTier } from '@/lib/plan-limits'
import { planDenied } from '@/lib/plan-guard'

const ALLOWED_MODULES = [
  'pos', 'inventory', 'caja', 'pedidos', 'catalog',
  'finanzas', 'reportes', 'analytics', 'kds', 'delivery', 'suppliers',
] as const

// core modules are always active — matches TabModulos.tsx alwaysOn:true.
// Todo lo demás (caja, pedidos, catalog, finanzas, reportes, analytics) es
// desactivable; forzarlos aquí pisaba el toggle del usuario en cada guardado.
const CORE_MODULES = ['pos', 'inventory'] as const

const modulesSchema = z.object({
  modules: z.array(z.enum(ALLOWED_MODULES)).min(1),
})

// P1 seguridad 2026-10-05 (auditoría CLI-C): catalog/finanzas/analytics/suppliers
// solo tenían gate de plan en el cliente (TabModulos.tsx requiresPlan), nunca
// server-side -- un admin en plan gratis podía activarlos llamando esta API
// directo. Mismo patrón que /api/config/theme (checkPlanLimit + planDenied),
// pero SIN llamar checkPlanLimit dentro de un loop (N+1 que .doc/AGENTS.md
// prohíbe explícitamente): se lee el negocio UNA vez acá y se evalúan los 4
// flags de PLAN_LIMITS ya resueltos, en vez de 4 llamadas que cada una vuelve
// a consultar la DB.
const GATED_MODULES = ['catalog', 'finanzas', 'analytics', 'suppliers'] as const
const GATE_MESSAGE: Record<typeof GATED_MODULES[number], string> = {
  catalog:   `El catálogo digital requiere plan ${PLAN_DISPLAY.negocio_activo}.`,
  finanzas:  `El módulo de finanzas requiere plan ${PLAN_DISPLAY.negocio_activo}.`,
  analytics: `Pulso del Negocio requiere plan ${PLAN_DISPLAY.negocio_activo}.`,
  suppliers: `El módulo de proveedores requiere plan ${PLAN_DISPLAY.negocio_activo}.`,
}

/* ── PATCH /api/config/business/modules — update enabled modules ── */

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = modulesSchema.parse(await req.json())

    const current = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { modules_enabled: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true },
    })
    if (!current) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    // Solo gatea la ACTIVACIÓN: un módulo que ya estaba encendido (tenant
    // grandfathered, o bajó de plan después) nunca se apaga por este chequeo --
    // desactivar siempre se permite, sin importar el plan.
    const currentlyEnabled = new Set((current.modules_enabled ?? '').split(',').filter(Boolean))
    const newlyActivated = GATED_MODULES.filter(m => body.modules.includes(m) && !currentlyEnabled.has(m))

    if (newlyActivated.length > 0) {
      if (!current.subscription_active) return planDenied('Tu suscripción está suspendida. Contacta a soporte.')
      if (current.subscription_expires_at && new Date() > current.subscription_expires_at) {
        return planDenied('Tu plan expiró. Renueva para continuar.')
      }
      const plan   = (current.catalog_plan as PlanTier | null) ?? 'gratis'
      const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.gratis
      const blocked = newlyActivated.find(m => !limits[m])
      if (blocked) return planDenied(GATE_MESSAGE[blocked])
    }

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
    select: { modules_enabled: true, catalog_plan: true, reservas_enabled: true },
  })

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const modules_enabled = (business.modules_enabled ?? '')
    .split(',')
    .filter(Boolean)

  // El catálogo digital, además del toggle, requiere plan pro/business.
  // Sidebar lo usa para ocultar el módulo aunque esté "activado" en modules_enabled.
  const plan = (business.catalog_plan as PlanTier | null) ?? 'gratis'
  const catalog_plan_allows = PLAN_LIMITS[plan]?.catalog ?? false

  return NextResponse.json({
    ok:              true,
    modules_enabled,
    allowed_modules: ALLOWED_MODULES,
    core_modules:    CORE_MODULES,
    catalog_plan_allows,
    // Flag por negocio (solo lectura acá). Va aparte de modules_enabled a propósito:
    // el PATCH de arriba reescribe esa lista completa y su enum no incluye "reservas".
    reservas_enabled: business.reservas_enabled,
  })
}
