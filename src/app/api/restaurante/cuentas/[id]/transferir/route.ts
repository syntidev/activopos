import { NextRequest, NextResponse } from 'next/server'
import { transferAccount, transferSchema } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/transferir — { table_id? , waiter_id? }: pasa la cuenta a otra mesa libre y/o a otro mesonero.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const parsed = transferSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    await transferAccount(access.db, access.session.businessId, access.session.userId, access.session.role, id, parsed.data)
    return NextResponse.json({ ok: true, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/transferir')
  }
}
