import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'

type RouteContext = { params: { id: string } }

export async function PATCH(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') {
      return NextResponse.json({ error: 'Solo administradores pueden marcar pagos' }, { status: 403 })
    }
    const planGate = await checkPlanLimit('access_finanzas')
    if (!planGate.allowed) return planDenied(planGate.reason)

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const gasto = await db.gasto.findFirst({
      where: { id, is_paid: false }, // business_id inyectado por el tenant layer
    })
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado o ya pagado' }, { status: 404 })
    }

    const updated = await db.gasto.update({
      where: { id }, // business_id inyectado por el tenant layer
      data:  { is_paid: true, paid_at: new Date() },
    })

    return NextResponse.json({ ok: true, gasto: { ...updated, monto_usd: Number(updated.monto_usd) } })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
