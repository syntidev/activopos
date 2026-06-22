import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAYS_VENCER = 7

export async function GET() {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const gastos = await prisma.gasto.findMany({
    where: { business_id: session.businessId, is_paid: false },
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
}
