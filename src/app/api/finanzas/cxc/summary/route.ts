import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAYS_VENCER = 7
const DAYS_LEGACY = 30

export async function GET() {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sales = await prisma.sale.findMany({
    where:   { business_id: session.businessId, status: 'pending' },
    include: { abonos: { select: { amount_usd: true } } },
  })

  const now     = new Date()
  const vencer7 = new Date(now.getTime() + DAYS_VENCER * 86_400_000)

  const buckets = { vencido: { count: 0, total_usd: 0 }, por_vencer: { count: 0, total_usd: 0 }, vigente: { count: 0, total_usd: 0 } }

  for (const s of sales) {
    const saldoUsd = Math.max(0, Number(s.total_usd) - s.abonos.reduce((a, b) => a + Number(b.amount_usd), 0))
    const deadline = s.due_date ?? new Date(s.created_at.getTime() + DAYS_LEGACY * 86_400_000)
    const bucket   = deadline < now ? 'vencido' : deadline <= vencer7 ? 'por_vencer' : 'vigente'
    buckets[bucket].count++
    buckets[bucket].total_usd = Math.round((buckets[bucket].total_usd + saldoUsd) * 100) / 100
  }

  return NextResponse.json({ ok: true, ...buckets })
}
