/** Tipos del checkout con envío (contrato de API para el carrito público y la configuración). */

export type ShippingKind = 'pickup' | 'delivery' | 'carrier' | 'carrier_branch'

export const SHIPPING_KINDS: readonly ShippingKind[] = ['pickup', 'delivery', 'carrier', 'carrier_branch']

/** Lo que ve el cliente en el carrito (lectura pública por slug): solo métodos activos. */
export interface PublicShippingMethod {
  id: number
  code: string
  label: string
  kind: ShippingKind
  requires_branch: boolean
  instructions: string | null
}

/** Lo que ve el negocio en Configuración (incluye inactivos). */
export interface ShippingMethodDTO extends PublicShippingMethod {
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Respuesta ÚNICA de /saved-address: misma forma exista o no la cédula. */
export interface SavedAddressResponse {
  has_saved_address: boolean
}
