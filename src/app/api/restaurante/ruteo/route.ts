import { NextRequest, NextResponse } from 'next/server'
import { loadRouting, routingSchema, setRouting } from '@/lib/restaurante-kds'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'

// GET /api/restaurante/ruteo — estación de cada categoría y productos con estación propia
export async function GET() {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    return NextResponse.json({ ok: true, routing: await loadRouting(access.db) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/ruteo')
  }
}

// PUT /api/restaurante/ruteo — { category_id, station_id|null, requires_preparation? } o { product_id, station_id|null }
export async function PUT(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const parsed = routingSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    await setRouting(access.db, parsed.data)
    return NextResponse.json({ ok: true, routing: await loadRouting(access.db) })
  } catch (err) {
    return handleRestauranteError(err, 'PUT /api/restaurante/ruteo')
  }
}
