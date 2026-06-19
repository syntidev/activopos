import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

const movementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount_bs: z.number().positive(),
  amount_usd: z.number().positive(),
  concept: z.string().min(3).max(150),
  payment_method_id: z.number().int().positive().optional(),
})

const findActiveRegister = (businessId: number) =>
  prisma.cashRegister.findFirst({
    where: { business_id: businessId, closed_at: null },
  })

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const register = await findActiveRegister(session.businessId)
  if (!register) {
    return NextResponse.json({ error: 'No hay caja abierta' }, { status: 400 })
  }

  const movements = await prisma.cashMovement.findMany({
    where: { cash_register_id: register.id, cash_register: { business_id: session.businessId } },
    include: {
      payment_method: { select: { id: true, name: true, type: true } },
      user: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ ok: true, movements })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = movementSchema.parse(await req.json())

    const register = await findActiveRegister(session.businessId)
    if (!register) {
      return NextResponse.json({ error: 'No hay caja abierta' }, { status: 400 })
    }

    const rate = await getBcvRate()

    const movement = await prisma.cashMovement.create({
      data: {
        business_id: session.businessId,
        cash_register_id: register.id,
        payment_method_id: body.payment_method_id,
        type: body.type,
        amount_bs: body.amount_bs,
        amount_usd: body.amount_usd,
        rate_used: rate,
        concept: body.concept,
        created_by: session.userId,
      },
      include: {
        payment_method: { select: { id: true, name: true, type: true } },
        user: { select: { name: true } },
      },
    })

    return NextResponse.json({ ok: true, movement }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('cash/movement error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
