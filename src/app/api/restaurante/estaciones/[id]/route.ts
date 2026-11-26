import { NextRequest, NextResponse } from 'next/server'
import { assertNoLiveTickets, assertThresholds, makeDefault, stationPatchSchema, toStation } from '@/lib/restaurante-kds'
import { AccountError, badRequest, handleRestauranteError, readJson, requireRestauranteAccess } from '@/lib/restaurante-server'
import { setStationUsers, usersByStation } from '@/lib/user-stations'

interface Ctx { params: { id: string } }

function stationId(params: Ctx['params']): number | null {
  const n = Number(params.id)
  return Number.isInteger(n) && n > 0 ? n : null
}

// PATCH /api/restaurante/estaciones/[id] — nombre, color, umbrales, por defecto, activa y cocineros asignados (user_ids)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db, session } = access
    const id = stationId(params)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const parsed = stationPatchSchema.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error)
    const { user_ids, is_default, ...fields } = parsed.data

    const current = await db.prepStation.findFirst({ where: { id } }) // business_id inyectado
    if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    assertThresholds(fields.warn_min ?? current.warn_min, fields.critical_min ?? current.critical_min)
    if (fields.active === false && current.is_default) throw new AccountError(422, 'La estación por defecto no se puede desactivar: marca otra como por defecto primero')
    if (fields.active === false && current.active) await assertNoLiveTickets(db, session.businessId, id)
    if (is_default === false && current.is_default) throw new AccountError(422, 'Marca otra estación como por defecto en lugar de quitar esta')

    if (user_ids !== undefined) await setStationUsers(db, session.businessId, id, user_ids)
    if (Object.keys(fields).length > 0) await db.prepStation.update({ where: { id }, data: fields })
    if (is_default === true) await makeDefault(db, id)

    const [fresh, users] = await Promise.all([db.prepStation.findFirst({ where: { id } }), usersByStation(db, session.businessId)])
    return NextResponse.json({ ok: true, station: toStation(fresh ?? current, { users: users.get(id) ?? [] }) })
  } catch (err) {
    return handleRestauranteError(err, 'PATCH /api/restaurante/estaciones/[id]')
  }
}

// DELETE /api/restaurante/estaciones/[id] — solo si nada la usa; si no, se desactiva en su lugar
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const access = await requireRestauranteAccess('admin')
    if (access instanceof NextResponse) return access
    const { db } = access
    const id = stationId(params)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const st = await db.prepStation.findFirst({ where: { id } })
    if (!st) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (st.is_default) throw new AccountError(422, 'La estación por defecto no se elimina: marca otra como por defecto primero')

    await assertNoLiveTickets(db, access.session.businessId, id)
    const [cats, prods, items] = await Promise.all([
      db.category.count({ where: { station_id: id } }), db.product.count({ where: { station_id: id } }), db.orderItem.count({ where: { station_id: id } }),
    ])
    if (cats + prods + items > 0) {
      await db.prepStation.update({ where: { id }, data: { active: false } })
      return NextResponse.json({ ok: true, deactivated: true })
    }
    await db.userStation.deleteMany({ where: { station_id: id, user: { business_id: access.session.businessId } } })
    await db.prepStation.delete({ where: { id } })
    return NextResponse.json({ ok: true, deactivated: false })
  } catch (err) {
    return handleRestauranteError(err, 'DELETE /api/restaurante/estaciones/[id]')
  }
}
