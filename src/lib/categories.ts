import type { Prisma } from '@prisma/client'

const NAME_MAX = 80 // categories.name es VarChar(80)

/**
 * Nombre con que queda una categoría eliminada o fusionada. Libera el unique (business_id, name):
 * el borrado es suave, así que sin renombrar el nombre quedaría reservado para siempre.
 */
export function deletedCategoryName(name: string, id: number): string {
  const suffix = ` [eliminada #${id}]`
  return name.slice(0, NAME_MAX - suffix.length) + suffix
}

/**
 * Categorías inactivas anteriores a este renombrado conservan su nombre original y chocarían con el
 * unique al crear, importar o renombrar. Las renombra igual que el borrado. business_id explícito.
 */
export async function releaseInactiveCategoryName(
  db: Pick<Prisma.TransactionClient, 'category'>,
  businessId: number,
  name: string,
): Promise<void> {
  const stale = await db.category.findMany({
    where:  { business_id: businessId, active: false, name },
    select: { id: true, name: true },
  })
  for (const c of stale) {
    await db.category.updateMany({
      where: { id: c.id, business_id: businessId },
      data:  { name: deletedCategoryName(c.name, c.id) },
    })
  }
}
