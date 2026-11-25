import { NextRequest, NextResponse } from 'next/server'
import { addItem, addItemSchema, loadAccount } from '@/lib/restaurante-cuenta'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

/**
 * POST /api/restaurante/cuentas/[id]/items — agrega un ítem borrador.
 * El cuerpo solo trae producto, cantidad, ids de modificadores, nota y curso. El precio lo calcula el servidor:
 * un price_per_unit_usd (o cualquier precio) en el cuerpo se descarta.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const orderId = Number(params.id)
    if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    const parsed = addItemSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const b = parsed.data

    await addItem(db, session.businessId, orderId, session.userId, {
      productId: b.product_id, quantity: b.quantity, modifierIds: b.modifier_ids ?? [], note: b.note?.trim() || null, course: b.course ?? 1,
    })
    return NextResponse.json({ ok: true, account: await loadAccount(db, orderId) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/items')
  }
}
