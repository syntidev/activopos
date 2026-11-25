import type { TenantPrisma } from '@/lib/prisma-tenant'
import { AccountError } from '@/lib/restaurante-server'

/**
 * Cocinero ↔ estaciones. UserStation NO tiene business_id, así que el tenant layer (que se deriva de esa columna) NO la aísla.
 * Todo acceso pasa por aquí y se acota por la FK al usuario Y a la estación, ambos del negocio de la sesión: un id de otro
 * negocio nunca se lee ni se escribe, aunque llegue en el cuerpo de una petición.
 */

/** Estaciones asignadas a un usuario del negocio. */
export async function stationIdsOfUser(db: TenantPrisma, businessId: number, userId: number): Promise<number[]> {
  const rows = await db.userStation.findMany({
    where:  { user_id: userId, user: { business_id: businessId }, station: { business_id: businessId } },
    select: { station_id: true },
  })
  return rows.map(r => r.station_id)
}

/** Usuarios (cocineros) asignados a cada estación del negocio. */
export async function usersByStation(db: TenantPrisma, businessId: number): Promise<Map<number, Array<{ id: number; name: string }>>> {
  const rows = await db.userStation.findMany({
    where:  { user: { business_id: businessId }, station: { business_id: businessId } },
    select: { station_id: true, user: { select: { id: true, name: true } } },
  })
  const map = new Map<number, Array<{ id: number; name: string }>>()
  for (const r of rows) map.set(r.station_id, [...(map.get(r.station_id) ?? []), r.user])
  return map
}

/**
 * Reemplaza los cocineros de una estación. La estación y cada usuario tienen que ser del negocio y los usuarios, activos con
 * rol kitchen; si alguno no lo es, 422 y no se escribe nada.
 */
export async function setStationUsers(db: TenantPrisma, businessId: number, stationId: number, userIds: readonly number[]): Promise<void> {
  const station = await db.prepStation.findFirst({ where: { id: stationId }, select: { id: true } }) // business_id inyectado
  if (!station) throw new AccountError(404, 'Estación no encontrada')

  const ids = Array.from(new Set(userIds))
  const valid = ids.length === 0 ? [] : await db.user.findMany({ where: { id: { in: ids }, is_active: true, role: 'kitchen' }, select: { id: true } }) // business_id inyectado
  if (valid.length !== ids.length) throw new AccountError(422, 'Alguno de los usuarios no existe, está inactivo o no tiene el rol de cocina')

  await db.$transaction([
    db.userStation.deleteMany({ where: { station_id: station.id, user: { business_id: businessId } } }),
    ...(ids.length > 0 ? [db.userStation.createMany({ data: ids.map(user_id => ({ user_id, station_id: station.id })) })] : []),
  ])
}
