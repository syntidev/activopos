import { NextRequest, NextResponse } from 'next/server'
import { fireCourse, fireSchema, requireKdsAccess } from '@/lib/restaurante-kds'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

// POST /api/restaurante/kds/disparar — { order_id, course }: libera un curso sin esperar al anterior (cocina, mesonero, cajero o admin)
export async function POST(req: NextRequest) {
  try {
    // Cocina entra por su puerta; el resto (sala) por la del módulo. Cada una responde 403 a quien no le toca.
    const kds = await requireKdsAccess()
    const access = kds instanceof NextResponse ? await requireRestauranteAccess() : kds
    if (access instanceof NextResponse) return access
    const parsed = fireSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    await fireCourse(access.db, access.session.businessId, access.session.userId, parsed.data.order_id, parsed.data.course, 'stationIds' in access ? access.stationIds : 'all')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/kds/disparar')
  }
}
