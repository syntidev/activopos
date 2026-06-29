import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const DAYS_VENCER = 7

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const gastos = await db.gasto.findMany({
      where: { is_paid: false }, // business_id inyectado por el tenant layer
    })

    const now     = new Date()
    const vencer7 = new Date(now.getTime() + DAYS_VENCER * 86_400_000)

    const buckets = { vencido: { count: 0, total_usd: 0 }, por_vencer: { count: 0, total_usd: 0 }, vigente: { count: 0, total_usd: 0 } }

    for (const g of gastos) {
      const monto = Number(g.monto_usd)
      let bucket: 'vencido' | 'por_vencer' | 'vigente'
      if (!g.due_date) {
        bucket = 'vigente'
      } else if (g.due_date < now) {
        bucket = 'vencido'
      } else if (g.due_date <= vencer7) {
        bucket = 'por_vencer'
      } else {
        bucket = 'vigente'
      }
      buckets[bucket].count++
      buckets[bucket].total_usd = Math.round((buckets[bucket].total_usd + monto) * 100) / 100
    }

    return NextResponse.json({ ok: true, ...buckets })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
