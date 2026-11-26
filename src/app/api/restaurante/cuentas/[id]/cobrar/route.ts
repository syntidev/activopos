import { NextRequest, NextResponse } from 'next/server'
import { getActiveRate } from '@/lib/bcv'
import { createCharges } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { handleRestauranteError, requireCashierAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/cobrar — crea UNA venta pendiente con todo lo que falta por cobrar (cajero o admin).
// El dinero entra después por PATCH /api/sales/[id]/pay (sin tocar): aquí el servidor fija líneas, precios, total y tasa.
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireCashierAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const { rate } = await getActiveRate(access.session.businessId)
    const result = await createCharges(access.db, { businessId: access.session.businessId, userId: access.session.userId }, id, Math.round(rate * 10000) / 10000, null)
    return NextResponse.json({ ok: true, ...result, account: await loadAccount(access.db, id) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/cobrar')
  }
}
