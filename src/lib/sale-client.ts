// Nombre del cliente de una venta: lo que se escribió en la venta (client_name)
// manda; la relación Client solo es respaldo. El registro Client puede haberse
// reusado por teléfono y tener otro nombre (venta 204: Manuel Torres vs Gilberto Perez).
export function saleClientName(sale: {
  client_name?: string | null
  client?: { name: string } | null
}): string | null {
  return sale.client_name?.trim() || sale.client?.name || null
}
