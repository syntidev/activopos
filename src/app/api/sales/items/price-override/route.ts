import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { checkAndIncrementPinAttempts, clearPinAttempts, verifyPin } from '@/lib/pin-rate-limit'

const schema = z.object({
  product_id:          z.number().int().positive(),
  variant_id:          z.number().int().positive().optional(),
  unit_price_override: z.number().positive(),
  override_reason:     z.string().max(255).optional(),
  pin:                 z.string().min(1).max(20),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const body = schema.parse(await req.json())

    const limited = await checkAndIncrementPinAttempts(session.businessId, session.userId)
    if (limited) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espere 5 minutos.' },
        { status: 429 }
      )
    }

    const authorizer = await verifyPin(session.businessId, body.pin)
    if (!authorizer) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }
    if (authorizer.role === 'cashier') {
      return NextResponse.json(
        { error: 'El PIN ingresado no corresponde a un administrador' },
        { status: 403 }
      )
    }

    await clearPinAttempts(session.businessId, session.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('price-override error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
