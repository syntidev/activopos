import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
  cedula: z.string().max(15).nullable().optional(),
  notes: z.string().nullable().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const client = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!client) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const [recentSales, cxcAgg] = await Promise.all([
      db.sale.findMany({
        where: {
          client_id: id,
          status: { not: 'cancelled' },
        },
        select: {
          id: true,
          ticket_number: true,
          status: true,
          total_usd: true,
          total_bs: true,
          sold_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      // Saldo CxC = suma de ventas pendientes (crédito sin pagar)
      db.sale.aggregate({
        where: {
          client_id: id,
          status: 'credit',
        },
        _sum: { total_bs: true, total_usd: true },
      }),
    ])

    return NextResponse.json({
    ok: true,
    client,
    cxc: {
      balance_bs: Number(cxcAgg._sum.total_bs ?? 0),
      balance_usd: Number(cxcAgg._sum.total_usd ?? 0),
    },
      recentSales: recentSales.map(s => ({
        ...s,
        total_usd: Number(s.total_usd),
        total_bs: Number(s.total_bs),
      })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json()
    const data = patchSchema.parse(body)

    const existing = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const client = await db.client.update({ where: { id }, data }) // business_id inyectado
    return NextResponse.json({ ok: true, client })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('Client patch error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const pendingBalance = await db.sale.count({
      where: { client_id: id, status: 'credit' }, // business_id inyectado
    })
    if (pendingBalance > 0) {
      return NextResponse.json(
        { error: `El cliente tiene ${pendingBalance} venta(s) pendiente(s) de cobro` },
        { status: 409 }
      )
    }

    await db.client.update({ where: { id }, data: { is_active: false } }) // business_id inyectado
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
