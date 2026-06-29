import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const clientId = parseInt(params.id, 10)
    if (isNaN(clientId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const client = await db.client.findFirst({
      where:  { id: clientId }, // business_id inyectado por el tenant layer
      select: { id: true, name: true, phone: true, email: true },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const [salesRaw, paymentMethods] = await Promise.all([
      db.sale.findMany({
        where:   { client_id: clientId }, // business_id inyectado por el tenant layer
        orderBy: { created_at: 'desc' },
        select: {
          id:            true,
          ticket_number: true,
          created_at:    true,
          total_usd:     true,
          total_bs:      true,
          status:        true,
          payments: {
            select: { payment_method: { select: { name: true } } },
          },
          items: {
            select: {
              product_name:       true,
              quantity:           true,
              price_per_unit_usd: true,
              subtotal_usd:       true,
            },
            orderBy: { id: 'asc' },
          },
          abonos: {
            select: {
              id:         true,
              amount_usd: true,
              created_at: true,
              notes:      true,
            },
            orderBy: { created_at: 'asc' },
          },
        },
      }),
      db.paymentMethod.findMany({
        where:   { is_active: true }, // business_id inyectado por el tenant layer
        orderBy: { sort_order: 'asc' },
        select:  { id: true, name: true, type: true },
      }),
    ])

    let balance_usd = 0
    for (const s of salesRaw) {
      if (s.status === 'pending') {
        const paid = s.abonos.reduce((acc, a) => acc + Number(a.amount_usd), 0)
        balance_usd += Math.max(0, Number(s.total_usd) - paid)
      }
    }

    const payments = salesRaw
      .flatMap(s => s.abonos.map(a => ({
        id:         a.id,
        amount_usd: Number(a.amount_usd),
        created_at: a.created_at,
        notes:      a.notes,
      })))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    const sales = salesRaw.map(s => {
      const methodNames = Array.from(new Set(s.payments.map(p => p.payment_method.name)))
      return {
        id:                  s.id,
        ticket_number:       s.ticket_number,
        created_at:          s.created_at,
        total_usd:           Number(s.total_usd),
        total_bs:            Number(s.total_bs),
        status:              s.status,
        payment_method_name: methodNames.length === 1
          ? methodNames[0]
          : methodNames.length > 1
            ? 'Mixto'
            : null,
        items: s.items.map(i => ({
          product_name: i.product_name,
          qty:          Number(i.quantity),
          price_usd:    Number(i.price_per_unit_usd),
          subtotal_usd: Number(i.subtotal_usd),
        })),
      }
    })

    return NextResponse.json({
      ok: true,
      client: { ...client, balance_usd: Math.round(balance_usd * 100) / 100 },
      sales,
      payments,
      paymentMethods,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
