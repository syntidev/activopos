import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getBcvRate } from '@/lib/bcv'

const movementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount_bs: z.number().min(0),
  amount_usd: z.number().min(0),
  concept: z.string().min(3).max(150),
  payment_method_id: z.number().int().positive().optional(),
})

const findActiveRegister = (businessId: number) =>
  prisma.cashRegister.findFirst({
    where: { business_id: businessId, closed_at: null },
  })

export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const register = await findActiveRegister(session.businessId)
    if (!register) {
      return NextResponse.json({ error: 'No hay caja abierta' }, { status: 400 })
    }

    const movements = await db.cashMovement.findMany({
      where: { cash_register_id: register.id }, // business_id inyectado por el tenant layer
      include: {
        payment_method: { select: { id: true, name: true, type: true } },
        user: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ ok: true, movements })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
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

    // Validación cruzada — tolerancia ±5% por redondeo y spread BCV/paralelo.
    // Cero-cero se deja pasar (movimiento en cero puede ser válido para notas).
    if (!(body.amount_usd === 0 && body.amount_bs === 0)) {
      const expectedBs = body.amount_usd * rate
      const tolerance   = expectedBs * 0.05
      const diff        = Math.abs(body.amount_bs - expectedBs)
      if (diff > tolerance) {
        return NextResponse.json(
          { error: 'Los montos USD y Bs son inconsistentes con la tasa actual' },
          { status: 400 },
        )
      }
    }

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
