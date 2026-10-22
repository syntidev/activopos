import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { PriceModeError, priceModeBodySchema, repriceOrderTx } from '@/lib/price-mode'
import { logError } from '@/lib/safe-log'

type Context = { params: { id: string } }

// PERMISOS — INTENCIONAL: sin guard de rol, igual que el resto de /api/orders (MATRIZ_ROLES_PERMISOS_SELLADA #2).

/* ── PATCH /api/orders/[id]/price-mode — cambia bcv|divisa en un pedido sin cobrar y lo recalcula ── */

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const orderId = Number(params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const parsed = priceModeBodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Modo de precio inválido' }, { status: 400 })

  try {
    // La tasa se consulta fuera de la transacción (puede llamar a la red).
    const { rate } = await getActiveRate(session.businessId)
    const ticket = await prisma.$transaction(tx =>
      repriceOrderTx(tx, { businessId: session.businessId, userId: session.userId }, orderId, parsed.data.price_mode, rate),
    )
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    if (err instanceof PriceModeError) return NextResponse.json({ error: err.message }, { status: err.status })
    logError('orders price-mode PATCH error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
