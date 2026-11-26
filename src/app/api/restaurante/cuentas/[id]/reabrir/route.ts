import { NextRequest, NextResponse } from 'next/server'
import { reopenAccount, reopenSchema } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/reabrir — SOLO admin: cancela las ventas pendientes y reabre la cuenta.
// Con ventas pagadas, primero se anulan en el POS (repone inventario) y después se reabre.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const parsed = reopenSchema.safeParse((await readJson(req)) ?? {})
    if (!parsed.success) return badRequest(parsed.error)
    await reopenAccount(access.db, access.session.businessId, access.session.userId, id, parsed.data.reason ?? null)
    return NextResponse.json({ ok: true, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/reabrir')
  }
}
