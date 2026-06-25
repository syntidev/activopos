import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { readCachedBcvRate } from '@/lib/bcv'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const now     = new Date()
  const in5days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

  const [gastos, rate] = await Promise.all([
    prisma.gasto.findMany({
      where: {
        business_id: session.businessId,
        is_paid:     false,
        due_date:    { gte: now, lte: in5days },
      },
      orderBy: { due_date: 'asc' },
      take:    50,
    }),
    readCachedBcvRate(),
  ])

  const r2 = (x: number) => Math.round(x * 100) / 100

  const alerts = gastos.map(g => {
    const msLeft       = g.due_date!.getTime() - now.getTime()
    const days_remaining = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    return {
      id:             g.id,
      concepto:       g.concepto,
      monto_usd:      Number(g.monto_usd),
      monto_bs:       r2(Number(g.monto_usd) * rate),
      due_date:       g.due_date,
      days_remaining,
      categoria:      g.categoria,
      supplier:       g.supplier,
    }
  })

  return NextResponse.json({ ok: true, alerts })
}
