import { NextRequest, NextResponse } from 'next/server'
import { assertThresholds, makeDefault, stationCreateSchema, toStation } from '@/lib/restaurante-kds'
import { badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'
import { usersByStation } from '@/lib/user-stations'

// GET /api/restaurante/estaciones — estaciones del negocio con sus cocineros (configuración, solo admin)
export async function GET() {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const [rows, users] = await Promise.all([
      db.prepStation.findMany({ orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }), // business_id inyectado
      usersByStation(db, session.businessId),
    ])
    return NextResponse.json({ ok: true, stations: rows.map(s => toStation(s, { users: users.get(s.id) ?? [] })) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/estaciones')
  }
}

// POST /api/restaurante/estaciones — crea una estación; la primera queda por defecto
export async function POST(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const parsed = stationCreateSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const d = parsed.data
    const warn = d.warn_min ?? 10
    const critical = d.critical_min ?? 20
    assertThresholds(warn, critical)

    const hasAny = (await db.prepStation.count({ where: { active: true } })) > 0
    const created = await db.prepStation.create({
      data: { business_id: session.businessId, name: d.name, color: d.color ?? null, warn_min: warn, critical_min: critical, sort_order: d.sort_order ?? 0, is_default: false },
    })
    if (d.is_default === true || !hasAny) await makeDefault(db, created.id)
    const fresh = await db.prepStation.findFirst({ where: { id: created.id } })
    return NextResponse.json({ ok: true, station: toStation(fresh ?? created, { users: [] }) }, { status: 201 })
  } catch (err) {
    return handleRestauranteError(err, 'POST /api/restaurante/estaciones')
  }
}
