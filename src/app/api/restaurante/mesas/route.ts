import { NextRequest, NextResponse } from 'next/server'
import { freeSpot, renderedSize } from '@/lib/restaurante'
import {
  TABLE_INCLUDE, badRequest, handleRestauranteError, parseSearchParam, readJson,
  requireRestauranteAccess, serializeTables, tableCreateSchema, takenBoxes, tablesBySearch,
} from '@/lib/restaurante-server'

const LIST_LIMIT = 500
const DEFAULT_SIZE = { rect: { w: 2, h: 2, cap: 4 }, round: { w: 2, h: 2, cap: 4 }, stool: { w: 1, h: 1, cap: 1 } } as const

// GET /api/restaurante/mesas?q=salon 2&area_id=3 — búsqueda híbrida: AND entre palabras, OR entre campos
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access

    const rawQ = req.nextUrl.searchParams.get('q')
    let where = {}
    if (rawQ !== null) {
      const search = parseSearchParam(rawQ)
      if (!search.ok) return NextResponse.json({ error: search.error }, { status: 400 })
      where = tablesBySearch(search.tokens)
    }
    const areaRaw = req.nextUrl.searchParams.get('area_id')
    const areaId = areaRaw === null ? null : Number(areaRaw)
    if (areaId !== null && (!Number.isInteger(areaId) || areaId <= 0)) {
      return NextResponse.json({ error: 'area_id inválido' }, { status: 400 })
    }

    const rows = await access.db.diningTable.findMany({
      where:   { ...where, ...(areaId !== null ? { area_id: areaId } : {}) },
      include: TABLE_INCLUDE,
      orderBy: [{ area_id: 'asc' }, { id: 'asc' }],
      take:    LIST_LIMIT,
    })
    return NextResponse.json({ ok: true, tables: await serializeTables(access.db, rows) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/mesas')
  }
}

// POST /api/restaurante/mesas — solo admin. Una mesa, o un lote {from, to} (13..16) en huecos libres del plano
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db, session } = access

    const parsed = tableCreateSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const body = parsed.data

    const area = await db.serviceArea.findFirst({ where: { id: body.area_id } })
    if (!area) return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })

    const shape = body.shape ?? 'rect'
    const size = DEFAULT_SIZE[shape]
    const labels = 'from' in body
      ? Array.from({ length: body.to - body.from + 1 }, (_, i) => String(body.from + i))
      : [body.label]

    const existing = await db.diningTable.findMany({ where: { area_id: area.id, label: { in: labels } }, select: { label: true } })
    if (existing.length > 0) {
      return NextResponse.json({ error: `Ya existen en ${area.name}: ${existing.map(e => e.label).join(', ')}` }, { status: 409 })
    }

    const single = 'from' in body ? null : body
    const width = single?.width ?? size.w
    const height = single?.height ?? size.h
    const rotation = single?.rotation ?? 0
    const box = renderedSize(width, height, rotation)
    const taken = await takenBoxes(db, area.id)

    const rows = await db.$transaction(labels.map(label => {
      const spot = single?.pos_x !== undefined && single.pos_y !== undefined
        ? { x: single.pos_x, y: single.pos_y }
        : freeSpot(taken, box.w, box.h)
      taken.push({ x: spot.x, y: spot.y, ...box })
      return db.diningTable.create({
        data: {
          business_id: session.businessId, area_id: area.id, label, shape,
          capacity: body.capacity ?? size.cap, pos_x: spot.x, pos_y: spot.y, width, height, rotation,
        },
        include: TABLE_INCLUDE,
      })
    }))
    return NextResponse.json({ ok: true, tables: await serializeTables(db, rows) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/mesas')
  }
}
