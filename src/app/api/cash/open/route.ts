import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

const openSchema = z.object({
  opening_amount_usd: z.number().min(0),
  opening_amount_bs: z.number().min(0),
  close_notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = openSchema.parse(await req.json())

    const existing = await prisma.cashRegister.findFirst({
      where: { business_id: session.businessId, closed_at: null },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ya hay una caja abierta' }, { status: 409 })
    }

    const rate = await getBcvRate()

    const register = await prisma.$transaction(async (tx) => {
      const reg = await tx.cashRegister.create({
        data: {
          business_id: session.businessId,
          cashier_id: session.userId,
          opening_amount_usd: body.opening_amount_usd,
          opening_amount_bs: body.opening_amount_bs,
          rate_at_open: rate,
        },
        include: { cashier: { select: { name: true } } },
      })

      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id: session.userId,
          action: 'cash_open',
          model_type: 'CashRegister',
          model_id: reg.id,
          new_values: {
            opening_amount_usd: body.opening_amount_usd,
            opening_amount_bs: body.opening_amount_bs,
            rate,
          },
        },
      })

      return reg
    })

    return NextResponse.json({ ok: true, register }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.errors }, { status: 400 })
    }
    console.error('cash/open error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
