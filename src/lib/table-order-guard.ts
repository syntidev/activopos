import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getAuthenticatedTenant } from '@/lib/tenant'

/**
 * Una cuenta de mesa (Order con origin = 'table') NO es un pedido: se gestiona desde Restaurante (su propio camino de cuenta,
 * cobro y anulación). Las rutas de Pedidos que MUTAN un pedido la rechazan con 422 TABLE_ORDER_USE_ACCOUNT, porque recalculan
 * desde el producto (perderían los modificadores), cobran por el camino del catálogo o cancelan sin pasar por la cuenta.
 * El origen de un pedido no cambia nunca, así que un chequeo previo a la transacción no tiene carrera.
 */

export const TABLE_ORDER_USE_ACCOUNT = 'TABLE_ORDER_USE_ACCOUNT'

/**
 * Para los include de ítems que arman líneas de venta: sin las anuladas (kds_status = 'void'). OJO con NULL: en los pedidos
 * normales kds_status es NULL y `not: 'void'` a secas los excluiría (NULL <> 'void' no es verdadero en SQL).
 */
export const LIVE_ITEMS: { where: Prisma.OrderItemWhereInput } = { where: { OR: [{ kds_status: null }, { kds_status: { not: 'void' } }] } }

export function tableOrderResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Este pedido es una cuenta de mesa: se gestiona desde Restaurante, no desde Pedidos.', code: TABLE_ORDER_USE_ACCOUNT },
    { status: 422 },
  )
}

/** null si el pedido (del negocio de la sesión) puede seguir; la respuesta 422 lista para devolver si es una cuenta de mesa. */
export async function rejectIfTableOrder(orderId: number): Promise<NextResponse | null> {
  const { db } = await getAuthenticatedTenant()
  const order = await db.order.findFirst({ where: { id: orderId }, select: { origin: true } }) // business_id inyectado por el tenant layer
  return order?.origin === 'table' ? tableOrderResponse() : null
}
