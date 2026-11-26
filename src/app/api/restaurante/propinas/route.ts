import { NextRequest, NextResponse } from 'next/server'
import { addTip, tipSchema } from '@/lib/restaurante-cobro'
import { badRequest, handleRestauranteError, readJson, requireCashierAccess } from '@/lib/restaurante-server'

// POST /api/restaurante/propinas — { sale_id, payment_method_id, amount_usd } (cajero o admin).
// La propina va FUERA del total de la venta: las ventas netas no cambian. Solo la de efectivo sube el efectivo esperado de caja.
export async function POST(req: NextRequest) {
  try {
    const access = await requireCashierAccess()
    if (access instanceof NextResponse) return access
    const parsed = tipSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const tip = await addTip(access.db, { businessId: access.session.businessId, userId: access.session.userId }, parsed.data)
    return NextResponse.json({ ok: true, tip }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/propinas')
  }
}
