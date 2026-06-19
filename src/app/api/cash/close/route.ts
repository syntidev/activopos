import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const closeSchema = z.object({
  closing_amount_usd: z.number().min(0),
  closing_amount_bs: z.number().min(0),
  close_notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = closeSchema.parse(await req.json())

    const closed = await prisma.$transaction(async (tx) => {
      // findFirst DENTRO de la TX — elimina TOCTOU entre check y update
      const register = await tx.cashRegister.findFirst({
        where: { business_id: session.businessId, closed_at: null },
      })
      if (!register) throw new Error('NO_OPEN_REGISTER')

      const reg = await tx.cashRegister.update({
        where: { id: register.id },
        data: {
          closing_amount_usd: body.closing_amount_usd,
          closing_amount_bs:  body.closing_amount_bs,
          close_notes:        body.close_notes,
          closed_at:          new Date(),
        },
      })

      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id:     session.userId,
          action:      'cash_close',
          model_type:  'CashRegister',
          model_id:    reg.id,
          old_values:  { opened_at: register.opened_at },
          new_values:  {
            closing_amount_usd: body.closing_amount_usd,
            closing_amount_bs:  body.closing_amount_bs,
          },
        },
      })

      return reg
    })

    return NextResponse.json({ ok: true, register: closed })
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_OPEN_REGISTER') {
      return NextResponse.json({ error: 'No hay caja abierta' }, { status: 400 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('cash/close error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
