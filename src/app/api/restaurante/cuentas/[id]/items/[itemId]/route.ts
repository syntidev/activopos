import { NextRequest, NextResponse } from 'next/server'
import { loadAccount, voidDraftItem, voidItemSchema } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string; itemId: string } }

// DELETE /api/restaurante/cuentas/[id]/items/[itemId] — quita un ítem que aún no se envió (queda anulado, con motivo y quién)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const orderId = Number(params.id)
    const itemId = Number(params.itemId)
    if (![orderId, itemId].every(n => Number.isInteger(n) && n > 0)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const raw = await readJson(req)
    const parsed = voidItemSchema.safeParse(raw ?? {})
    if (!parsed.success) return badRequest(parsed.error)

    await voidDraftItem(db, session.businessId, orderId, itemId, { id: session.userId, role: session.role }, parsed.data.reason)
    return NextResponse.json({ ok: true, account: await loadAccount(db, orderId) })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/cuentas/[id]/items/[itemId]')
  }
}
