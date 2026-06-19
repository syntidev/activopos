import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAYS_CREDIT = 30 // días de crédito por defecto

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const status = sp.get('status') ?? 'todo' // pendiente | vencido | todo

  const sales = await prisma.sale.findMany({
    where: {
      business_id: session.businessId,
      status:      'pending',
    },
    include: {
      client:  { select: { id: true, name: true, phone: true, cedula: true } },
      abonos:  { select: { amount_usd: true } },
    },
    orderBy: { created_at: 'asc' },
  })

  const now = Date.now()

  const cxc = sales.map(s => {
    const totalUsd       = Number(s.total_usd)
    const abonadoUsd     = s.abonos.reduce((acc, a) => acc + Number(a.amount_usd), 0)
    const saldoUsd       = Math.max(0, Math.round((totalUsd - abonadoUsd) * 100) / 100)
    const vencimientoMs  = new Date(s.created_at).getTime() + DAYS_CREDIT * 86_400_000
    const diasVencido    = Math.max(0, Math.floor((now - vencimientoMs) / 86_400_000))
    const vencido        = diasVencido > 0

    return {
      sale_id:       s.id,
      ticket_number: s.ticket_number,
      client_id:     s.client_id,
      client_name:   s.client?.name ?? s.client_name ?? 'Sin nombre',
      client_phone:  s.client?.phone ?? s.client_phone ?? null,
      created_at:    s.created_at.toISOString(),
      vencimiento:   new Date(vencimientoMs).toISOString().split('T')[0],
      total_usd:     totalUsd,
      abonado_usd:   Math.round(abonadoUsd * 100) / 100,
      saldo_usd:     saldoUsd,
      dias_vencido:  diasVencido,
      vencido,
    }
  }).filter(c => {
    if (status === 'vencido')   return c.vencido
    if (status === 'pendiente') return !c.vencido
    return true
  })

  const totals = {
    count:       cxc.length,
    saldo_usd:   Math.round(cxc.reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100,
    vencido_usd: Math.round(cxc.filter(c => c.vencido).reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100,
  }

  return NextResponse.json({ ok: true, cxc, totals })
}
