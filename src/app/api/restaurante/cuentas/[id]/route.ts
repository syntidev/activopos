import { NextRequest, NextResponse } from 'next/server'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { handleRestauranteError, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// GET /api/restaurante/cuentas/[id] — la cuenta con sus líneas y totales en USD y Bs
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/cuentas/[id]')
  }
}
