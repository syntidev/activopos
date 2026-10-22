import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FinancingError, applyFinancingActionTx, financingActionSchema } from '@/lib/ticket-financing'
import { logError } from '@/lib/safe-log'

type Context = { params: { id: string } }

// PERMISOS — INTENCIONAL: sin guard de rol, igual que el resto de /api/orders (MATRIZ_ROLES_PERMISOS_SELLADA #2).

/* ── PATCH /api/orders/[id]/financing — declara, aprueba, rechaza o retira el financiamiento (Cashea) de un pedido sin cobrar ── */

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const orderId = Number(params.id)
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const parsed = financingActionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

  try {
    const ticket = await prisma.$transaction(tx =>
      applyFinancingActionTx(tx, { businessId: session.businessId, userId: session.userId, role: session.role }, 'order', orderId, parsed.data.action),
    )
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    if (err instanceof FinancingError) return NextResponse.json({ error: err.message, blocked_products: err.blockedProducts }, { status: err.status })
    logError('orders financing PATCH error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
