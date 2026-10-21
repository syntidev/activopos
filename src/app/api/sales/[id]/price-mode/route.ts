import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { PriceModeError, priceModeBodySchema, repriceSaleTx } from '@/lib/price-mode'
import { logError } from '@/lib/safe-log'

type Context = { params: { id: string } }

// PERMISOS: igual que /api/pos/drafts — el cajero cambia el modo de SUS pestañas abiertas (repriceSaleTx
// oculta las de otro cajero); no expone costos.

/* ── PATCH /api/sales/[id]/price-mode — cambia bcv|divisa en una venta abierta y la recalcula ── */

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const saleId = Number(params.id)
  if (!Number.isInteger(saleId) || saleId <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const parsed = priceModeBodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Modo de precio inválido' }, { status: 400 })

  try {
    // La tasa se consulta fuera de la transacción (puede llamar a la red).
    const { rate } = await getActiveRate(session.businessId)
    const ticket = await prisma.$transaction(tx =>
      repriceSaleTx(tx, { businessId: session.businessId, userId: session.userId, role: session.role }, saleId, parsed.data.price_mode, rate),
    )
    return NextResponse.json({ ok: true, ticket })
  } catch (err) {
    if (err instanceof PriceModeError) return NextResponse.json({ error: err.message }, { status: err.status })
    logError('sales price-mode PATCH error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
