import { NextRequest, NextResponse } from 'next/server'
import { mergeAccounts, mergeSchema } from '@/lib/restaurante-cobro'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/juntar — { source_id }: la cuenta origen se une a esta (sus ítems pasan aquí y su mesa queda unida).
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    const parsed = mergeSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    await mergeAccounts(access.db, access.session.businessId, access.session.userId, id, parsed.data.source_id)
    return NextResponse.json({ ok: true, account: await loadAccount(access.db, id) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/juntar')
  }
}
