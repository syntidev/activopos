import { NextRequest, NextResponse } from 'next/server'
import { syncAccount } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { handleRestauranteError, requireCashierAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/sincronizar — tras pagar: cierra la cuenta si todo quedó cubierto y pagado (idempotente).
// /pay no sabe de cuentas de mesa; este es el único camino que las cierra, y la mesa pasa a "por limpiar".
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireCashierAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const { closed } = await syncAccount(access.db, access.session.businessId, access.session.userId, id)
    return NextResponse.json({ ok: true, closed, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/sincronizar')
  }
}
