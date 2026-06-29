import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const DAYS_VENCER = 7
const DAYS_LEGACY = 30  // fallback for sales without due_date

const querySchema = z.object({
  status: z.enum(['vigente', 'por_vencer', 'vencido']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
})

function classifySale(due_date: Date | null, created_at: Date, now: Date): 'vigente' | 'por_vencer' | 'vencido' {
  const vencer7 = new Date(now.getTime() + DAYS_VENCER * 86_400_000)
  const deadline = due_date ?? new Date(created_at.getTime() + DAYS_LEGACY * 86_400_000)
  if (deadline < now)                             return 'vencido'
  if (deadline >= now && deadline <= vencer7)     return 'por_vencer'
  return 'vigente'
}

export async function GET(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const query  = querySchema.parse(params)

    // Fetch all pending sales with abonos for this business
    const allPending = await db.sale.findMany({
      where:   { status: 'pending' }, // business_id inyectado por el tenant layer
      include: {
        client: { select: { id: true, name: true, phone: true, cedula: true } },
        abonos: { select: { amount_usd: true } },
      },
      orderBy: { created_at: 'asc' },
    })

    const now = new Date()

    const classified = allPending.map(s => {
      const totalUsd   = Number(s.total_usd)
      const abonadoUsd = s.abonos.reduce((acc, a) => acc + Number(a.amount_usd), 0)
      const saldoUsd   = Math.max(0, Math.round((totalUsd - abonadoUsd) * 100) / 100)
      const bucket     = classifySale(s.due_date, s.created_at, now)
      const deadline   = s.due_date ?? new Date(s.created_at.getTime() + DAYS_LEGACY * 86_400_000)
      const diasVencido = bucket === 'vencido'
        ? Math.floor((now.getTime() - deadline.getTime()) / 86_400_000)
        : 0

      return {
        sale_id:       s.id,
        ticket_number: s.ticket_number,
        client_id:     s.client_id,
        client_name:   s.client?.name ?? s.client_name ?? 'Sin nombre',
        client_phone:  s.client?.phone ?? null,
        created_at:    s.created_at.toISOString(),
        due_date:      deadline.toISOString().split('T')[0],
        credit_days:   s.credit_days,
        credit_notes:  s.credit_notes,
        total_usd:     totalUsd,
        abonado_usd:   Math.round(abonadoUsd * 100) / 100,
        saldo_usd:     saldoUsd,
        dias_vencido:  diasVencido,
        bucket,
      }
    })

    // Aggregated totals (before pagination)
    const vencido_usd    = Math.round(classified.filter(c => c.bucket === 'vencido').reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100
    const por_vencer_usd = Math.round(classified.filter(c => c.bucket === 'por_vencer').reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100
    const vigente_usd    = Math.round(classified.filter(c => c.bucket === 'vigente').reduce((s, c) => s + c.saldo_usd, 0) * 100) / 100

    // Filter by bucket if requested
    const filtered = query.status ? classified.filter(c => c.bucket === query.status) : classified

    // Paginate
    const total = filtered.length
    const items = filtered.slice((query.page - 1) * query.limit, query.page * query.limit)

    return NextResponse.json({
      ok: true,
      items,
      total,
      pagination: {
        page:  query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      },
      vencido_usd,
      por_vencer_usd,
      vigente_usd,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
