import { NextRequest, NextResponse } from 'next/server'
import { loadAccount } from '@/lib/restaurante-cuenta'
import { sendItems, sendSchema } from '@/lib/restaurante-kds'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

interface Ctx { params: { id: string } }

// POST /api/restaurante/cuentas/[id]/enviar — pasa los borradores (todos, o un curso) a las estaciones
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const orderId = Number(params.id)
    if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const parsed = sendSchema.safeParse((await readJson(req)) ?? {})
    if (!parsed.success) return badRequest(parsed.error)

    const result = await sendItems(db, session.businessId, orderId, session.userId, parsed.data.course ?? null)
    return NextResponse.json({ ok: true, ...result, account: await loadAccount(db, orderId) })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/cuentas/[id]/enviar')
  }
}
