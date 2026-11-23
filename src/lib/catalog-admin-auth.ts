import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'

/**
 * Guard de las APIs de configuración que solo aplican a negocios con catálogo (Identidad web, SEO y Analítica):
 * admin del negocio (o super_admin) y plan con catálogo. business_id SIEMPRE de la sesión, nunca del body ni de la query.
 */
export interface CatalogAdmin { businessId: number }

export async function requireAdminConCatalogo(): Promise<CatalogAdmin | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const business = await prisma.business.findUnique({ where: { id: session.businessId }, select: { catalog_plan: true } })
  const plan = (business?.catalog_plan as PlanTier | null) ?? 'gratis'
  if (!(PLAN_LIMITS[plan]?.catalog ?? false)) return NextResponse.json({ error: 'Disponible en el plan con catálogo' }, { status: 403 })
  return { businessId: session.businessId }
}
