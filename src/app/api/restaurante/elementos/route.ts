import { NextRequest, NextResponse } from 'next/server'
import {
  badRequest, elementCreateSchema, handleRestauranteError, readJson, requireRestauranteAccess, serializeElement,
} from '@/lib/restaurante-server'

// GET /api/restaurante/elementos?area_id=3 — muros, entrada, barra y pase del plano
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access
    const areaRaw = req.nextUrl.searchParams.get('area_id')
    const areaId = areaRaw === null ? null : Number(areaRaw)
    if (areaId !== null && (!Number.isInteger(areaId) || areaId <= 0)) {
      return NextResponse.json({ error: 'area_id inválido' }, { status: 400 })
    }
    const rows = await access.db.floorElement.findMany({
      where:   areaId !== null ? { area_id: areaId } : {},
      orderBy: { id: 'asc' },
    })
    return NextResponse.json({ ok: true, elements: rows.map(serializeElement) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/elementos')
  }
}

// POST /api/restaurante/elementos — solo admin
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const parsed = elementCreateSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)

    const area = await access.db.serviceArea.findFirst({ where: { id: parsed.data.area_id } })
    if (!area) return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })

    const row = await access.db.floorElement.create({
      data: { business_id: access.session.businessId, ...parsed.data, label: parsed.data.label ?? null },
    })
    return NextResponse.json({ ok: true, element: serializeElement(row) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/elementos')
  }
}
