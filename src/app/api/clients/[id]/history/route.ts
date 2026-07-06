import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { getClientHistory } from '@/lib/clients'

type RouteContext = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const clientId = parseInt(params.id, 10)
    if (isNaN(clientId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [history, paymentMethods] = await Promise.all([
      getClientHistory(clientId, session.businessId),
      db.paymentMethod.findMany({
        where:   { is_active: true }, // business_id inyectado por el tenant layer
        orderBy: { sort_order: 'asc' },
        select:  { id: true, name: true, type: true },
      }),
    ])

    if (!history) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    return NextResponse.json({
      ok:      true,
      client:  history.client,
      sales:   history.sales,
      paymentMethods,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
