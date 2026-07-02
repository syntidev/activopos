import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkPlanLimit } from '@/lib/plan-guard'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { nextPlanTier, type PlanTier } from '@/lib/plan-limits'

const checkSchema = z.object({
  action: z.enum(['create_product', 'create_user', 'access_catalog', 'access_ai', 'create_supplier']),
})

export async function POST(req: Request) {
  try {
    const { session } = await getAuthenticatedTenant()

    let data: z.infer<typeof checkSchema>
    try {
      data = checkSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const result = await checkPlanLimit(data.action)
    if (result.allowed) return NextResponse.json({ allowed: true })

    // Solo sugerir upgrade cuando el bloqueo es por límite/feature de plan, no por suspensión/expiración
    const business = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { catalog_plan: true, subscription_active: true, subscription_expires_at: true },
    })
    const plan = (business?.catalog_plan as PlanTier | null) ?? 'trial'
    const isPlanLimited = business?.subscription_active
      && !(business.subscription_expires_at && new Date() > business.subscription_expires_at)

    return NextResponse.json({
      allowed: false,
      reason:  result.reason,
      ...(isPlanLimited ? { upgrade_to: nextPlanTier(plan) } : {}),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
