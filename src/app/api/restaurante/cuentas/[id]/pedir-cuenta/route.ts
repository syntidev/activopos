import { NextRequest, NextResponse } from 'next/server'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { requestBill } from '@/lib/restaurante-cobro'
import { handleRestauranteError, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/pedir-cuenta — la cuenta pasa a "por cobrar" (mesonero, cajero o admin). Pedir algo más la reabre.
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    await requestBill(access.db, access.session.businessId, id, access.session.userId)
    return NextResponse.json({ ok: true, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/pedir-cuenta')
  }
}
