import type { ShippingKind, ShippingMethodDTO } from '@/types/shipping'

/** Roles que pueden crear, editar o borrar métodos de envío: lista blanca explícita (todo lo demás, 403). */
export const SHIPPING_WRITE_ROLES: readonly string[] = ['admin']

interface MethodRow {
  id: number
  code: string
  label: string
  kind: string
  requires_branch: boolean
  active: boolean
  sort_order: number
  instructions: string | null
  created_at: Date
  updated_at: Date
}

/** Fila de business_shipping_methods → DTO de Configuración (fechas ISO). */
export function toShippingMethodDTO(r: MethodRow): ShippingMethodDTO {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    kind: r.kind as ShippingKind,
    requires_branch: r.requires_branch,
    active: r.active,
    sort_order: r.sort_order,
    instructions: r.instructions,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }
}
