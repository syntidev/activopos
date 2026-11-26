import { NextRequest, NextResponse } from 'next/server'
import { getActiveRate } from '@/lib/bcv'
import { chargeSchema, createCharges } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireCashierAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/dividir (cajero o admin)
//   { kind: 'items', groups: [[{ item_id, quantity? }, …], …] } → N ventas pendientes, una por subcuenta (cantidades fraccionarias válidas)
//   { kind: 'equal', parts: N }                                  → 1 venta pendiente y el reparto en N partes (hasta 10: tope de pagos de /pay)
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireCashierAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const parsed = chargeSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const { rate } = await getActiveRate(access.session.businessId)
    const result = await createCharges(access.db, { businessId: access.session.businessId, userId: access.session.userId }, id, Math.round(rate * 10000) / 10000, parsed.data)
    return NextResponse.json({ ok: true, ...result, account: await loadAccount(access.db, id) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/dividir')
  }
}
