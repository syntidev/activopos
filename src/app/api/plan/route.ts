import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'

type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'suspended'

function deriveStatus(plan: PlanTier, subscriptionActive: boolean, expiresAt: Date | null): SubscriptionStatus {
  if (!subscriptionActive) return 'suspended'
  if (expiresAt && new Date() > expiresAt) return 'expired'
  if (plan === 'trial') return 'trial'
  return 'active'
}

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    // Business no tiene business_id propio — no es un modelo tenant-scoped, se lee directo
    const business = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { catalog_plan: true, subscription_active: true, subscription_expires_at: true },
    })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const plan   = (business.catalog_plan as PlanTier | null) ?? 'trial'
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial

    const [productsUsed, usersUsed] = await Promise.all([
      db.product.count({ where: { active: true } }), // business_id inyectado
      db.user.count(),                                // business_id inyectado
    ])

    const expiresAt = business.subscription_expires_at
    let days_remaining: number | null = null
    if (expiresAt) {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      days_remaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    return NextResponse.json({
      ok: true,
      plan,
      status:      deriveStatus(plan, business.subscription_active, expiresAt),
      expires_at:  expiresAt ? expiresAt.toISOString().slice(0, 10) : null,
      usage: {
        products:        { used: productsUsed, limit: limits.products },
        users:            { used: usersUsed,    limit: limits.users },
        catalog_enabled:  limits.catalog,
        ai_enabled:       limits.ai,
      },
      days_remaining,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
