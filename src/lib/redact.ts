/**
 * Redaccion de campos financieros por rol.
 *
 * El cajero no ve costos (regla sellada del proyecto, mismo criterio que
 * /api/finanzas/*): se despoja el campo en vez de bloquear el endpoint, porque
 * el cajero SI necesita el resto del payload para operar el POS.
 *
 * Vive aca y no inline en cada route porque el bug original fue justo ese: el
 * patron se escribio a mano en el GET de /api/sales y en /api/reports/sales, y
 * se olvido en el POST de sales y en los 3 endpoints de drafts. Un helper
 * compartido hace que el proximo endpoint que devuelva `items` no repita la
 * omision.
 */

/** Quita `cost_per_unit_usd` de cada item. El tipo de salida refleja la omision. */
export function redactItemCosts<T extends { cost_per_unit_usd: unknown }>(
  items: T[]
): Omit<T, 'cost_per_unit_usd'>[] {
  return items.map(({ cost_per_unit_usd, ...item }) => item)
}

/**
 * Envuelve la respuesta justo antes del NextResponse.json: despoja los costos
 * si el rol es cajero, devuelve la venta intacta si no lo es.
 */
export function redactSaleForRole<T extends { items: { cost_per_unit_usd: unknown }[] }>(
  sale: T,
  role: string
): T | (Omit<T, 'items'> & { items: Omit<T['items'][number], 'cost_per_unit_usd'>[] }) {
  if (role !== 'cashier') return sale
  const { items, ...rest } = sale
  return { ...rest, items: redactItemCosts(items) }
}
