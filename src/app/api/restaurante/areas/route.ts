import { NextRequest, NextResponse } from 'next/server'
import {
  areaCreateSchema, badRequest, handleRestauranteError, readJson, requireRestauranteAccess, serializeArea,
} from '@/lib/restaurante-server'

const COUNT_ACTIVE_TABLES = { _count: { select: { tables: { where: { active: true } } } } }

// GET /api/restaurante/areas — áreas del negocio con su cantidad de mesas activas
export async function GET() {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const rows = await access.db.serviceArea.findMany({ include: COUNT_ACTIVE_TABLES, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] })
    return NextResponse.json({ ok: true, areas: rows.map(r => serializeArea(r, r._count.tables)) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/areas')
  }
}

// POST /api/restaurante/areas — solo admin
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const parsed = areaCreateSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)

    const sort_order = parsed.data.sort_order ?? await access.db.serviceArea.count()
    const row = await access.db.serviceArea.create({
      data: { business_id: access.session.businessId, name: parsed.data.name, sort_order },
    })
    return NextResponse.json({ ok: true, area: serializeArea(row, 0) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/areas')
  }
}
