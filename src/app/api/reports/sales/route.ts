export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['quote', 'pending', 'paid', 'cancelled', 'credit']).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  cashier_id: z.coerce.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const query = querySchema.parse(params)

    const where = {
      // business_id inyectado por el tenant layer
      ...(query.status && { status: query.status }),
      ...(query.from || query.to
        ? {
            created_at: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(`${query.to}T23:59:59`) }),
            },
          }
        : {}),
      ...(query.cashier_id && { cashier_id: query.cashier_id }),
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: true,
          payments: {
            include: {
              payment_method: { select: { id: true, name: true, type: true } },
            },
          },
          client: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      db.sale.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      sales,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('reports/sales error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
