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

/** Datos para precargar el checkout en un dispositivo nuevo: SOLO cuando cédula Y teléfono son del mismo cliente. */
export interface CheckoutPrefill {
  name:    string
  address: string | null
}

/** Respuesta ÚNICA de /saved-address: misma forma exista o no la cédula (`prefill` solo con cédula Y teléfono coincidentes). */
export interface SavedAddressResponse {
  has_saved_address: boolean
  prefill?: CheckoutPrefill
}
