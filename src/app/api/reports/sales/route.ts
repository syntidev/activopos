import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['quote', 'pending', 'paid', 'cancelled']).optional(),
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const query = querySchema.parse(params)

    const where = {
      business_id: session.businessId,
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
      prisma.sale.findMany({
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
      prisma.sale.count({ where }),
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
